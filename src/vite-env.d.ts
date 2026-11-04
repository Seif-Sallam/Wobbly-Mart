/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Board API; unset in a build = no online features. */
  readonly VITE_API_URL?: string;
}
