import { Inngest } from 'inngest';

// Create Inngest client
// Events are sent from our API routes to trigger background functions
export const inngest = new Inngest({
  id: 'special-trips',
  name: 'Special Trips',
});
