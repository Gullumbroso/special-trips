I want you to help me apply a cool color styling to the app.
The idea we'll implement -- each onboarding page, and each bundle section and page, will get a unique coloring in the page, which will apply a cool, dynmaic feel to the app.

I will provide combinations of background + foreground colors, and we'll develop a mechanism that, either randomly or according to some logic, will apply the coloring to that section / page.

## Coloring Rules

- Apply foreground colors to all typography and elements.
- Apply foreground color to the logo_type svg in the navbar.
- Apply background colors to the background and navbars
- For elements:
  - Primary Buttons: 
    - background: foreground color
    - color: white
  - Secondary Button:
    - background: foreground color with alpha 0.08
    - color: foreground color
  - Chips:
    - background: foreground color with alpha 0.08
    - color: foreground color

## Color Combinations

- Pink Blue: 
  - Background: #FFF5F7
  - Foreground: #00437E
- Green Red: 
  - Background: #F1FBF5
  - Foreground: #650405
- Blue Green: 
  - Background: #F6F9FF
  - Foreground: #124E04
- Yellow Purple: 
  - Background: #FFF9F0
  - Foreground: #63014A

## Coloring Logic

- Interests Page: Pink Blue
- Music Taste Page: Green Red
- Trip Timeframe: Blue Green 
- Other Details Page: Yellow Purple
- Bundles Page: 
  - Navbar & Logo & Trip Summary: White Black
  - Bundle Sections: Random combinations (different than one another) 
- Bundle Details Page: Bundle's color combination from the Bundles Page (to maintain coloring consistency).

Please refer docs/figma/Bundle Details Page.png and docs/figma/Bundles Page.png for the design of these pages.