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
            window.lastPanoDate = data.imageDate;
            window.lastPanoId = data.location.pano;
        }
        else {
            document.getElementById("streetview").innerText = "Could not find panorama within 25m of coordinates"
        }
    });
}
