import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Client {
  id: string;
  companyName: string;
}

interface GeocodedClient {
  clientId: string;
  coordinates: [number, number]; // [longitude, latitude]
  address: string;
}

interface RouteMapProps {
  clients: Client[];
  geocodedClients: GeocodedClient[];
  startingCoordinates?: [number, number]; // [longitude, latitude]
}

export function RouteMap({ clients, geocodedClients, startingCoordinates }: RouteMapProps) {
  // Convert [lng, lat] to [lat, lng] for Leaflet
  const positions: LatLngExpression[] = geocodedClients.map(gc => [gc.coordinates[1], gc.coordinates[0]]);
  
  // Calculate center of map
  const center: LatLngExpression = positions.length > 0 
    ? positions[Math.floor(positions.length / 2)]
    : [43.6532, -79.3832]; // Default to Toronto

  // Add starting location to the route if provided
  const routePoints = startingCoordinates 
    ? [[startingCoordinates[1], startingCoordinates[0]], ...positions] as LatLngExpression[]
    : positions;

  return (
    <div className="w-full h-[400px] rounded-md overflow-hidden border" data-testid="map-route">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Starting location marker */}
        {startingCoordinates && (
          <Marker 
            position={[startingCoordinates[1], startingCoordinates[0]]}
            icon={createStartIcon()}
          >
            <Popup>
              <div className="text-sm font-medium">Starting Location</div>
            </Popup>
          </Marker>
        )}

        {/* Client markers */}
        {geocodedClients.map((gc, index) => {
          const client = clients.find(c => c.id === gc.clientId);
          return (
            <Marker
              key={gc.clientId}
              position={[gc.coordinates[1], gc.coordinates[0]]}
              icon={createNumberedIcon(index + 1)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">{client?.companyName}</div>
                  <div className="text-xs text-muted-foreground">{gc.address}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route line */}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#3b82f6',
              weight: 3,
              opacity: 0.7
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

// Helper function to create numbered marker icon
function createNumberedIcon(number: number) {
  return new L.DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #3b82f6;
        color: white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">${number}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Helper function to create starting location icon
function createStartIcon() {
  return new L.DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #22c55e;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="
          background-color: white;
          border-radius: 50%;
          width: 12px;
          height: 12px;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}
