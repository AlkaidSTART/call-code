import type { SessionStoreLike } from './store-types';

let sharedStore: SessionStoreLike | null = null;

/** 获取进程内共享的 SessionStoreLike。 */
export const getSharedSessionStore = (): SessionStoreLike => {
  if (!sharedStore) {
    throw new Error('会话存储未初始化，请先调用 setSharedSessionStore');
  }
  return sharedStore;
};

/** 获取当前共享存储，未初始化时返回 null。 */
export const getSharedSessionStoreOrNull = (): SessionStoreLike | null => sharedStore;

/** 替换共享 SessionStore，测试传入 :memory: 或注入自定义实例时使用。 */
export const setSharedSessionStore = (store: SessionStoreLike | null): void => {
  sharedStore = store;
};

/** 关闭并清空共享 SessionStore。 */
export const closeSharedSessionStore = (): void => {
  sharedStore?.close?.();
  sharedStore = null;
};
