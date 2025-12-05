import { Subject } from 'rxjs';

const eventBus = new Subject();

// Update emit to accept isRemote flag
export const emit = (type, payload, isRemote = false) => {
  // We log differently for clarity
  if(isRemote) console.log(`[BUS-REMOTE] ${type}`);
  else console.log(`[BUS-LOCAL] ${type}`);

  eventBus.next({ type, payload, isRemote });
};

export const on = (callback) => {
  return eventBus.subscribe(callback);
};
