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
 * Time travel dropdown onchange method 
 */
function timeTravel(panoId) {
    window.sv.setPano(panoId);
}

/**
 * Take an array of available panoramas and their dates
 * and return a list of <option> elements for a drop-down,
 * with the date closest to targetDate selected.
 */
function generateOptionsAndReturnClosestPano(panoArray, targetDate) {
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
            // For logging only
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
 * Take an array of available panoramas and their dates
 * and return a list of <option> elements for a drop-down.
 */
function generateDateSelectOptions(panoArray) {
    const options = [];

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
        options.push(option);
    });

    options[0].selected = true;

    return options;
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
    svService.getPanorama(panoRequest, function (panoData, status) {
        if (status === StreetViewStatus.OK) {
            console.debug(
                `Status ${status}: panorama found.`
            );
            let heading, zoom, pitch;
            // Compute the heading towards the coordinates
            heading = spherical.computeHeading(
                panoData.location.latLng,
                coordinates
            );
            zoom = 0;
            pitch = 0;

            const sv = new StreetViewPanorama(
                document.getElementById("streetview"),
                {
                    position: coordinates,
                    center: coordinates,
                    zoom: zoom,
                    pov: {
                        heading: heading,
                        pitch: pitch,
                    },
                    imageDateControl: true,
                    fullscreenControl: false,
                }
            );
            sv.setPano(panoData.location.pano);

            const map = new Map(document.getElementById("satellite"), {
                center: coordinates,
                mapTypeId: "hybrid",
                zoom: 18,
                controlSize: 25,
                fullscreenControl: false,
                mapTypeControl: false,
            });
            map.setStreetView(sv);
            
            // Make these available globally so we can access them later
            window.sv = sv;
            window.map = map;
            window.lastPanoDate = panoData.imageDate;
            window.lastPanoId = panoData.location.pano;
            
            // Generate the list of options, with the initial panorama date selected
            const { options } = generateOptionsAndReturnClosestPano(
                panoData.time,
                panoData.imageDate
            );
            // Attach the options to the select
            document.getElementById("time-travel-select").append(...options);
                
            // Set the time travel select visible only once the map is fully loaded
            // otherwise you see it appear on the side of the screen first
            event.addListenerOnce(map, "idle", () => {
                document.getElementById("time-travel-container").style.display = "flex";
            });

            // Register a mutation observer to attach events to the pegman
            const observer = new MutationObserver(attachEventsToPegman);
            const config = { attributes: true, childList: true, subtree: true };
            observer.observe(document.getElementById("streetview"), config);
            observer.observe(document.getElementById("satellite"), config);
            

            // Custom event launched when pegman is dropped and we need a manual pano set
            sv.addListener("manual_pano_set", () => {
                // The sleep is needed, otherwise it breaks for some unknown reason
                sleep(0).then(() => {
                    sv.setPano(window.shouldBePano);
                    console.debug(
                        `Changed pano to ${window.shouldBePano}`
                    );
                });
            });

            
            sv.addListener("pano_changed", () => {
                console.debug("pano_changed");

                const newPanoId = sv.getPano();
                
                // Detect when we need to manually update the panorama after a pegman drop
                if (window.manualPanoSetNeeded) {
                    window.manualPanoSetNeeded = false;
                    console.debug(
                        `Starting change to ${window.shouldBePano}`
                    );
                    // trigger custom event
                    return event.trigger(sv, "manual_pano_set");
                }
                // Skip duplicate events
                if (window.lastPanoId === newPanoId) {
                    console.debug(
                        `Extra event on ${window.lastPanoId}, returning!`
                    );
                    return;
                }

                // Get more info on the pano from StreetViewService
                svService.getPanorama({ pano: newPanoId }, function (panoData, status) {
                    if (status === StreetViewStatus.OK) {
                        console.debug(
                            `New pano: ${newPanoId} - (${panoData.imageDate})`
                        );
                        console.debug(
                            `Last pano: ${window.lastPanoId} - (${window.lastPanoDate})`
                        );
                        
                        // If the pegman was just dropped and the new panorama's date is not equal
                        // to the last panorama's date, we manually change the panorama to the 
                        // one closest in time to the pre-pegman drop date.
                        if (window.pegmanDropped && panoData.imageDate !== window.lastPanoDate) {
                            window.pegmanDropped = false;
                            console.debug(
                                "Pegman dropped and new pano date not equal to last."
                            );
                            // Get the ID of the panorama closest in time to the last date
                            var { options, closestPanoId, closestPanoDate } =
                                generateOptionsAndReturnClosestPano(
                                    panoData.time,
                                    window.lastPanoDate
                                );
                            console.debug(
                                `Will change to closest pano ${closestPanoId} (${closestPanoDate})`
                            );
                            // Set this variable so we know we need to change the panorama
                            window.manualPanoSetNeeded = true;
                            window.shouldBePano = closestPanoId;
                            // save the current pano date for next time
                            window.lastPanoDate = panoData.imageDate;
                            window.lastPanoId = newPanoId;
                            return;
                        }
                        console.debug(
                            `Generating dropdown options for new pano`
                        );
                        var { options } =
                            generateOptionsAndReturnClosestPano(
                                panoData.time,
                                panoData.imageDate
                            );
                        document.getElementById("time-travel-select")
                                .replaceChildren(...options);

                        // save the current pano date for next time
                        window.lastPanoDate = panoData.imageDate;
                        window.lastPanoId = newPanoId;
                    }}
                );
            });
            return;
        }
        else {
            document.getElementById("streetview").innerText = "Could not find panorama within 25m of coordinates"
        }
    });
}
