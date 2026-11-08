import { initialState, assertState, clone } from './core.js';

export class LocalStore {
  constructor(database) { this.db = database; this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(database.name) : null; }
  static async open(name, catalog, now = Date.now()) {
    if (!globalThis.indexedDB) throw new Error('このブラウザーでは端末内保存を利用できません。通常のSafariで開いてください。');
    const db = await new Promise((resolve,reject) => {
      const request = indexedDB.open(name,1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('別の画面を閉じてから開き直してください。'));
    });
    const store = new LocalStore(db);
    db.onversionchange = () => db.close();
    await store.update(() => {}, { catalog, now, initialize: true });
    return store;
  }
  async read() {
    return new Promise((resolve,reject) => {
      const tx = this.db.transaction('state','readonly'), request = tx.objectStore('state').get('current');
      let state;
      request.onsuccess = () => { state = request.result; };
      tx.oncomplete = () => { try { assertState(state); resolve(state); } catch (error) { reject(error); } };
      tx.onerror = () => reject(tx.error || new Error('保存データを読み込めません。'));
    });
  }
  // bodyは同期処理限定。読み書きと整合性検証を同じreadwriteトランザクション内で行う。
  async update(body, options = {}) {
    return new Promise((resolve,reject) => {
      let tx;
      try { tx = this.db.transaction('state','readwrite',{durability:'strict'}); }
      catch { tx = this.db.transaction('state','readwrite'); }
      const object = tx.objectStore('state'), request = object.get('current');
      let state, result, failure;
      request.onsuccess = () => {
        try {
          state = request.result;
          if (state === undefined && options.initialize) state = initialState(options.now,options.catalog);
          if (!state) throw new Error('保存データを読み込めません。初期化は行いません。');
          assertState(state);
          result = body(state);
          if (result && typeof result.then === 'function') throw new Error('非同期の取引は保存できません。');
          assertState(state); object.put(state,'current');
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { this.channel?.postMessage('changed'); resolve({state:clone(state),result}); };
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('端末への保存に失敗しました。空き容量・ブラウザー設定を確認してください。'));
    });
  }
  close() { this.channel?.close(); this.db.close(); }
}
