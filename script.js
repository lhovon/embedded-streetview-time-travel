(async function initMap() {
    const { StreetViewService } = await google.maps.importLibrary("streetView");
    const svService = new StreetViewService();
    const coordinates = {
        lat: 45.4580915864,
        lng: -73.5754052827,
    };
    const panoRequest = {
        radius: 25,
        location: coordinates,
    };
    findPanorama(svService, panoRequest, coordinates);
})();

/**
 * Take an array of available panoramas and their dates
 * and return a list of <option> elements for a drop-down,
 * with the date closest to targetDate selected.
 */
function generateTimeTravelOptions(panoArray, targetDate) {
    const options = [];

    // Convert the selected date string in YYYY-mm format to a Date
    const dateSplit = targetDate.split("-");
    const selectedPanoDate = new Date(dateSplit[0], parseInt(dateSplit[1]) - 1, 1);

    let closestPanoEl, minDiff = Infinity;
    
    // Assuming the objects have only 2 keys: "pano" and the variably-named date key
    const dateKey = Object.keys(panoArray[0]).filter(e => {return e !== "pano";})[0];
    
    // Iterate through the available times in reverse
    // order so the most recent date appears at the top
    panoArray.reverse().forEach(el => {
        const option = document.createElement("option");
        option.value = option.id = el["pano"];
        
        const date = el[dateKey];

        // User visible text of the dropdown option
        option.innerText = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
        });
        // Keep track of the smallest absolute difference between 
        // the selected date and the avaiable dates
        const diff = Math.abs(selectedPanoDate - date);

        if (diff < minDiff) {
            minDiff = diff;
            closestPanoEl = option;
        }
        options.push(option);
    });
    // Set the minimum difference element to selected
    closestPanoEl.selected = true;
    return options;
}


async function findPanorama(svService, panoRequest, coordinates) {
    const { Map } = await google.maps.importLibrary("maps");
    const { spherical } = await google.maps.importLibrary("geometry");
    const { StreetViewStatus, StreetViewPanorama } = await google.maps.importLibrary("streetView");

    // Send a request to the panorama service
    svService.getPanorama(panoRequest, function (data, status) {
        if (status === StreetViewStatus.OK) {
            console.debug(`Status ${status}: panorama found.`);
            // Compute the heading towards the coordinates
            const heading = spherical.computeHeading(
                data.location.latLng,
                coordinates
            );

            const sv = new StreetViewPanorama(
                document.getElementById("streetview"), 
                {
                    position: coordinates, 
                    zoom: 0,
                    pov: {heading: heading, pitch: 0},
                    imageDateControl: true,
                    fullscreenControl: false // would be hidden by time travel
                }
            );
            sv.setPano(data.location.pano);

            const map = new Map(document.getElementById("satellite"), {
                center: coordinates,
                mapTypeId: "hybrid",
                zoom: 18,
            });
            map.setStreetView(sv);
            
            // Make these available globally so we can access them later
            window.sv = sv;
            window.map = map;
            
            // Generate the list of options, with the initial panorama date selected
            const options = generateTimeTravelOptions(
                data.time,
                data.imageDate
            );
            // Attach the options to the select
            document.getElementById("time-travel-select").append(...options);
            document.getElementById("time-travel-container").style.display = "flex";

            sv.addListener("pano_changed", () => {
                console.debug("pano_changed");
                const newPanoId = sv.getPano();
                
                // Get more info on the pano from StreetViewService
                svService.getPanorama({ pano: newPanoId }, function (data, status) {
                    if (status === StreetViewStatus.OK) {
                        console.debug(`Generating dropdown options for new pano`);
                        const options = generateTimeTravelOptions(data.time, data.imageDate);
                        
                        document.getElementById("time-travel-select")
                                .replaceChildren(...options);
                    }}
                );
            });
        }
        else {
            document.getElementById("streetview").innerText = "Could not find panorama within 25m of coordinates"
        }
    });
}
