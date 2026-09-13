// Firestore stores JSON strings so existing plan snapshots (including nested arrays)
// remain byte-for-byte compatible with repository exports.
export function changesFor(key, value, records) {
  const changes = [];
  const add = (id, data) => {
    const payload = JSON.stringify(data);
    if (records[id]?.payload !== payload) changes.push({id, payload, revision: records[id]?.revision || 0});
  };
  const addMap = (prefix, map) => {
    for (const [id, item] of Object.entries(map)) add(`${prefix}-${id}`, item);
    for (const [id, record] of Object.entries(records)) {
      if (id.startsWith(`${prefix}-`) && record.payload !== 'null' && !Object.hasOwn(map, id.slice(prefix.length + 1))) add(id, null);
    }
  };
  if (key === 'dinner-plans-v1') {
    for (const week of value) add(`week-${week.id}`, week);
    for (const [id, record] of Object.entries(records)) {
      if (id.startsWith('week-') && record.payload !== 'null' && !value.some(w => `week-${w.id}` === id)) add(id, null);
    }
  } else if (key === 'dinner-draft-v1') add('draft', value);
  else if (key === 'dinner-tried-v1') {
    for (const [id, tried] of Object.entries(value)) add(`tried-${id}`, tried);
  }
  else if (key === 'dinner-comments-v1') addMap('comment', value);
  else if (key === 'dinner-favourites-v1') addMap('favourite', value);
  else throw new Error('Unknown save type');
  return changes;
}

export function decodeRecords(records, emptyDraft) {
  const saved = [], tried = {}, comments = {}, favourites = {};
  let draft = emptyDraft;
  for (const [id, record] of Object.entries(records)) {
    const value = JSON.parse(record.payload);
    if (value === null) continue;
    if (id.startsWith('week-')) saved.push(value);
    else if (id.startsWith('tried-')) tried[id.slice(6)] = value;
    else if (id.startsWith('comment-')) comments[id.slice(8)] = value;
    else if (id.startsWith('favourite-')) favourites[id.slice(10)] = value;
    else if (id === 'draft') draft = value;
  }
  return {saved, tried, comments, favourites, draft};
}

export async function connectCloud(config, onAuth, onRecords, onError) {
  const [appSDK, authSDK, dbSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'),
  ]);
  const firebase = appSDK.initializeApp(config.firebase);
  const auth = authSDK.getAuth(firebase), db = dbSDK.getFirestore(firebase);
  await authSDK.setPersistence(auth, authSDK.browserLocalPersistence);
  const collection = dbSDK.collection(db, 'households', config.householdUid, 'records');
  const recordsFromSnapshot = snapshot => Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data()]));
  let unsubscribe = () => {};
  authSDK.onAuthStateChanged(auth, user => {
    unsubscribe();
    onAuth(Boolean(user && user.uid === config.householdUid));
    if (!user) return;
    if (user.uid !== config.householdUid) { void authSDK.signOut(auth); return; }
    unsubscribe = dbSDK.onSnapshot(collection, {includeMetadataChanges:true}, snapshot => {
      // Never report a cached/optimistic write as saved to the server.
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      onRecords(recordsFromSnapshot(snapshot));
    }, onError);
  }, onError);
  return {
    login: password => authSDK.signInWithEmailAndPassword(auth, config.householdEmail, password),
    logout: () => authSDK.signOut(auth),
    save: changes => writeChanges(dbSDK, db, collection, changes),
    refresh: async () => recordsFromSnapshot(await dbSDK.getDocsFromServer(collection)),
  };
}

export async function writeChanges(dbSDK, db, collection, changes) {
      if (!changes.length) return;
      await dbSDK.runTransaction(db, async transaction => {
        const refs = changes.map(change => dbSDK.doc(collection, change.id));
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        snapshots.forEach((snapshot, i) => {
          if ((snapshot.exists() ? snapshot.data().revision : 0) !== changes[i].revision) {
            const error = new Error('This item changed on another device. Reload the latest saves before editing it again.');
            error.code = 'app/conflict';
            throw error;
          }
        });
        changes.forEach((change, i) => transaction.set(refs[i], {
          payload: change.payload, revision: change.revision + 1, updatedAt: dbSDK.serverTimestamp(),
        }));
      });
    }
