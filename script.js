(async function initMap() {
    const { StreetViewService } = await google.maps.importLibrary("streetView");
    const svService = new StreetViewService();

    let coordinates = {
        lat: 45.4580915864,
        lng: -73.5754052827,
    };
    let panoRequest = {
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
    const selectedPanoDate = new Date(
        dateSplit[0],
        parseInt(dateSplit[1]) - 1,
        1
    );

    let minDiff = Infinity;
    let closestPanoEl, closestPanoDate;
    
    // Assuming the objects have only 2 keys: "pano" and the variably-named date key
    const dateKey = Object.keys(panoArray[0]).filter(e => {return e !== "pano";})[0];
    
    // Iterate through the available times in reverse
    // order so the most recent date appears at the top
    panoArray.reverse().forEach(el => {
        let option = document.createElement("option");
        option.value = option.id = el["pano"];

        const date = el[dateKey];
        if (!date) {
            console.error("Could not get date from element: ", el);
            return;
        }
        // User visible text of the dropdown option
        option.innerText = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
        });
        // Keep track of the smallest absolute difference between 
        // the selected date and the avaiable dates
        let diff = Math.abs(selectedPanoDate - date);

        if (diff < minDiff) {
            minDiff = diff;
            closestPanoEl = option;
            closestPanoDate = `${date.toISOString().split('T')[0].substring(0, 7)}`;
        }
        options.push(option);
    });

    // Set the minimum difference element to selected
    closestPanoEl.selected = true;

    return {
        options: options,
        closestPanoId: closestPanoEl.value,
        closestPanoDate: closestPanoDate
    };
}


/**
 * Register a drag and drop listener on the pegman
 * We can't just document.querySelector() it easily because
 * we need to wait for it to have been instantiated first
 */
function attachEventsToPegman(mutationList) {
    for (const mutation of mutationList) {
        if ( // Found this identifies the pegman 
            mutation.target.getAttribute("src") ===
            "https://maps.gstatic.com/mapfiles/transparent.png"
        ) {
            // Detect if events were already set on the pegman
            if (mutation.target.getAttribute('listenersSet')) return;

            console.debug('Attaching events on pegman');
            // Save a reference if needed later
            window.pegman = mutation.target;

            // Add event listeners to the element
            mutation.target.addEventListener("mousedown", () => {
                console.debug("mousedown");
                window.pegmanDropped = false;
                window.pegmanMousedown = true;
            });
            mutation.target.addEventListener("mouseup", () => {
                console.debug("mouseup");
                if (window.pegmanMousedown) {
                    window.pegmanMousedown = false;
                    window.pegmanDropped = true;
                }
            });
            mutation.target.setAttribute('listenersSet', 'true');
        }
    }
}

/** 
 * Use this to print all the mutations and search for relevant ones
*/
function printMutationsCallback(mutationList, _) {
    for (const mutation of mutationList) {
        console.debug(mutation);
    }
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function findPanorama(svService, panoRequest, coordinates) {
    const { Map } = await google.maps.importLibrary("maps");
    const { event } = await google.maps.importLibrary("core");
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
                    pano: data.location.pano,
                    position: coordinates,
                    zoom: 0,
                    pov: {
                        heading: heading,
                        pitch: 0,
                    },
                    imageDateControl: true,
                    fullscreenControl: false,
                    motionTracking: false,
                    motionTrackingControl: false,
                }
            );

            const map = new Map(document.getElementById("satellite"), {
                center: coordinates,
                zoom: 18,
                controlSize: 25,
                fullscreenControl: false,
                mapTypeControl: false,
            });
            map.setStreetView(sv);
            
            // Make these available globally so we can access them later
            window.sv = sv;
            window.map = map;
            window.lastPanoDate = data.imageDate;
            window.lastPanoId = data.location.pano;
            
            // Generate the list of options, with the initial panorama date selected
            const { options } = generateTimeTravelOptions(
                data.time,
                data.imageDate
            );
            // Attach the options to the select
            document.getElementById("time-travel-select").append(...options);
            document.getElementById("time-travel-container").style.display = "flex";

            // Register a mutation observer to attach events to the pegman
            const observer = new MutationObserver(attachEventsToPegman);
            const config = { attributes: true, subtree: true };
            observer.observe(document.getElementById("satellite"), config);

            // Custom event launched when pegman is dropped and we need a manual pano set
            sv.addListener("pano_change_needed", () => {
                // The sleep is needed, otherwise it breaks for some unknown reason
                sleep(0).then(() => {
                    sv.setPano(window.shouldBePano);
                    console.debug(`Changed pano to ${window.shouldBePano}`);
                });
            });
            
            sv.addListener("pano_changed", () => {
                console.debug("pano_changed");

                const newPanoId = sv.getPano();
                
                // Detect when we need to change the panorama after a pegman drop
                if (window.panoChangeNeeded) {
                    window.panoChangeNeeded = false;
                    console.debug(`Starting change to ${window.shouldBePano}`);
                    // trigger custom event
                    return event.trigger(sv, "pano_change_needed");
                }
                // Skip duplicate events
                if (window.lastPanoId === newPanoId) {
                    console.debug(`Extra event on ${window.lastPanoId}, returning!`);
                    return;
                }

                // Get more info on the pano from StreetViewService
                svService.getPanorama({ pano: newPanoId }, (data, status) => {
                    if (status === StreetViewStatus.OK) {
                        console.debug(`New pano: ${newPanoId} - (${data.imageDate})`);
                        console.debug(`Last pano: ${window.lastPanoId} - (${window.lastPanoDate})`);
                        
                        // If the pegman was just dropped and the new panorama's date is not equal
                        // to the last panorama's date, we manually change the panorama to the 
                        // one closest in time to the pre-pegman drop date.
                        if (window.pegmanDropped && data.imageDate !== window.lastPanoDate) {
                            window.pegmanDropped = false;
                            console.debug("Pegman dropped and new pano date not equal to last."
                            );
                            // Get the ID of the panorama closest in time to the last date
                            const { closestPanoId, closestPanoDate } =
                                generateTimeTravelOptions(
                                    data.time,
                                    window.lastPanoDate
                                );
                            console.debug(
                                `Will change to closest pano ${closestPanoId} (${closestPanoDate})`
                            );
                            // Set this variable so we know we need to change the pano
                            window.panoChangeNeeded = true;
                            window.shouldBePano = closestPanoId;
                            return;
                        }
                        console.debug(`Generating dropdown options for new pano`);

                        const { options } = generateTimeTravelOptions(
                            data.time,
                            data.imageDate
                        );
                        document.getElementById("time-travel-select")
                                .replaceChildren(...options);

                        // save the current pano date for next time
                        window.lastPanoDate = data.imageDate;
                        window.lastPanoId = newPanoId;
                    }}
                );
            });
        }
        else {
            document.getElementById("streetview").innerText = "Could not find panorama within 25m of coordinates"
        }
    });
}
