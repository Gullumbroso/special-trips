## Onboarding Flow (happy path)
1. User lands on the /welcome
2. User clicks "Let's go" -> directed to /interests
3. User selects at least two interests; all interests are selected by default
4. User clicks "Next" -> saves "interests" to local storage and directed to /music_taste
5. User writes his music preferences in the textarea
6. User clicks "Next" -> saves "music_taste" to local storage and directed to /trip_timeframe
7. User writes his trip timeframe in the input field
8. User clicks "Next" -> saves "trip_timeframe" to local storage and directed to /other_details
9. User writes his last preferences in the textarea (optional)
10. User clicks "Done" -> saves "other_details" to local storage and directed to the /loading_bundles

## Loading Page
1. User lands on /loading_bundles page, where there's a message that reads "Working on it...", and "This might take a few minutes.\nWe’ll let you know once we’re done.
2. Once the bundles successfully loaded, user is directed to /bundles

## Bundles Page (Feed)
**Goal:** Let the user browse the curated bundles and choose one to explore.

**Happy Flow:**
1. User lands on /bundles
2. User sees a vertical feed of trip bundles cards the include - image, trip title, timeframe, city, trip description, and key events
3. User scrolls to review each trip bundle
4. User clicks "Explore [bundle_x.city] Trip" -> directed to /bundles/[bundle_x.id]

## Bundle Details Page
**Goal:** Let the user understand the full set of events and their details in the trip bundle.

**Happy Flow:**
1. User lands on /bundle/[id] from /bundles
2. Users sees the trip bundle details: 
  - image
  - title
  - timeframe
  - city
  - high-level description
  - key & minor events overview
  - key events details (image, title, description, timeframe, website_link)
  - minor events details (image, title, description, timeframe, website_link)
3. User clicks "Go to website" -> opens the website link in a new tab
4. User clicks "Back" -> directed back to /bundles
  