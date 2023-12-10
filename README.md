# Streetview JS API Time Travel

Proof of concept implementation of a time travel feature in an embedded Streetview container.

## Final result
![Image 1: Final result of the time travel feature in streetview](assets/time-travel-final-result.webp)

## Features

- Switching between the available time periods at a location.
- Maintaining the selected time period (or the closest available one) while moving around using the links.
- Maintaining the selected time period (or the closest available one) after moving the Pegman, which is not supported in the real google maps!

## Notes

- This requires a [Maps API key](https://developers.google.com/maps/documentation/javascript/cloud-setup) (there's a $200/month free credit)
- Replace `YOUR_API_KEY` in `index.html` with your key :) 
- To start somewhere else, replace the `lat` and `lng` coordinates in `script.js::initMap()`

See a detailed breakdown on my blog: https://loichovon.com/posts/streetview-time-travel.html
