import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'special-trips',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
