import { wireAvatarWorker, type AvatarWorkerScope } from "./avatarWorkerCore";

/* The avatar worker's entry: 3-D avatar renders happen here, off the page's main thread. */
wireAvatarWorker(globalThis as unknown as AvatarWorkerScope);
