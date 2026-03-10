import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import {
  Car,
  MapPin,
  Clock,
  Zap
} from "lucide-react"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { carAPI ,stationAPI , slotAPI, bookableCarAPI } from "@/lib/api"
import L from "leaflet"


interface Vehicle {
  id: string
  brand: string
  model: string
  car_number: string
  charger_type: string
}

interface Station {
  id: string
  name: string
  address: string
  latitude: string
  longitude: string
  supported_charger_types: string[]
}



const userLocationIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "user-location-marker",
})

const BookingPage = () => {

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const navigate = useNavigate()

  
const [stations, setStations] = useState<Station[]>([])
const [filteredStations, setFilteredStations] = useState<Station[]>([])
const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  
    const [vehicles, setVehicles] = useState<Vehicle[]>([])

const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
// CONFIRMED vehicle (shown in slot)

const [tempVehicle, setTempVehicle] = useState<Vehicle | null>(null)
// TEMP vehicle (inside dialog)
const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)

const [availableSlots, setAvailableSlots] = useState<number | null>(null)
const [loadingSlots, setLoadingSlots] = useState(false)

useEffect(() => {
  if (!navigator.geolocation) {
    console.error("Geolocation not supported")
    return
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setUserLocation([
        pos.coords.latitude,
        pos.coords.longitude,
      ])
    },
    (err) => {
      console.error("Location error:", err)
      // fallback (Hyderabad)
      setUserLocation([17.48, 78.52])
    }
  )
}, [])

useEffect(() => {
  if (!userLocation) return

  const fetchNearbyStations = async () => {
    try {
      const [lat, lng] = userLocation
      const res = await stationAPI.getNearbyStations(lat, lng)

      setStations(res.data)
      setFilteredStations(res.data) // default before filtering
    } catch (err) {
      console.error("Failed to fetch nearby stations", err)
    }
  }

  fetchNearbyStations()
}, [userLocation])

useEffect(() => {
  if (!selectedStation) return

  const fetchAvailability = async () => {
    setLoadingSlots(true)
    try {
      const res = await stationAPI.getAvailability(selectedStation.id)
      setAvailableSlots(res.data.available_slots)
    } finally {
      setLoadingSlots(false)
    }
  }

  fetchAvailability()
}, [selectedStation])


useEffect(() => {
  const fetchVehicles = async () => {
    try {
      const res = await bookableCarAPI.getBookableCars()
      setVehicles(res.data)
    } catch (err) {
      console.error("Failed to load vehicles", err)
    }
  }

  fetchVehicles()
}, [])

// REMOVE: this effect was overwriting the nearby-stations list with all stations
// useEffect(() => {
//   const fetchStations = async () => {
//     try {
//       const res = await stationAPI.getStations()
//       setStations(res.data)
//       setFilteredStations(res.data) // default: show all
//     } catch (err) {
//       console.error("Failed to fetch stations", err)
//     }
//   }
//
//   fetchStations()
// }, [])

const filterStationsByVehicle = (vehicle: Vehicle) => {
  const compatible = stations.filter((station) =>
    station.supported_charger_types?.includes(vehicle.charger_type)
  )
  setFilteredStations(compatible)
}

// If user clears vehicle selection, restore nearby stations
useEffect(() => {
  if (!selectedVehicle) {
    setFilteredStations(stations)
  }
}, [selectedVehicle, stations])


  return (
    <div className="h-screen w-screen flex overflow-hidden">

      {/* ----------------------------
         LEFT OVERLAY PANEL
      ----------------------------- */}
      <div className="w-full md:w-[380px] bg-card border-r border-border z-10 flex flex-col">

  {/* Header */}
  <div className="p-5 border-b space-y-3">

    {/* Back Button */}
    <button
      onClick={() => navigate("/dashboard")}
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Dashboard
    </button>

    {/* Title */}
    <div>
      <h1 className="text-lg font-semibold">
        Book Charging Slot
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Select vehicle → station → slot
      </p>
    </div>

  </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* STEP 1 — VEHICLE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Car className="w-4 h-4" />
              Select Vehicle
            </div>

             {/* SINGLE VEHICLE SLOT */}
  <div
    onClick={() => {
      setTempVehicle(selectedVehicle)
      setVehicleDialogOpen(true)
    }}
    className="p-4 rounded-xl border cursor-pointer hover:bg-muted transition"
  >
    {selectedVehicle ? (
      <>
        <p className="font-medium">
          {selectedVehicle.brand} {selectedVehicle.model}
        </p>
        <p className="text-sm text-muted-foreground">
          {selectedVehicle.car_number} · {selectedVehicle.charger_type}
        </p>
      </>
    ) : (
      <p className="text-sm text-muted-foreground">
        Select a vehicle
      </p>
    )}
  </div>
</div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* STEP 2 — STATION */}
          <div className="space-y-3">
  <div className="flex items-center gap-2 text-sm font-medium">
    <MapPin className="w-4 h-4" />
    Selected Station
  </div>

  <div className="p-4 rounded-xl border bg-muted/40">
    {selectedStation ? (
      <>
        <p className="font-medium">
          {selectedStation.name}
        </p>

        <p className="text-sm text-muted-foreground mt-1">
          {selectedStation.address}
        </p>

        <div className="flex flex-wrap gap-2 mt-3">
          {selectedStation.supported_charger_types.map(type => (
            <span
              key={type}
              className="text-xs px-2 py-1 rounded-full bg-accent text-primary"
            >
              {type}
            </span>
          ))}
        </div>
      </>
    ) : (
      <p className="text-sm text-muted-foreground">
        Select a station from the map
      </p>
    )}
  </div>
</div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* STEP 3 — SLOT */}
          <div className="space-y-3">
  <div className="flex items-center gap-2 text-sm font-medium">
    <Clock className="w-4 h-4" />
    Slot Availability
  </div>

  <div className="p-4 rounded-xl border bg-muted/40">
    {!selectedStation ? (
      <p className="text-sm text-muted-foreground">
        Select a station to view availability
      </p>
    ) : loadingSlots ? (
      <p className="text-sm text-muted-foreground">
        Checking availability…
      </p>
    ) : availableSlots === 0 ? (
      <p className="text-sm text-red-600 font-medium">
        No slots available
      </p>
    ) : (
      <p className="text-sm text-primary font-medium">
        {availableSlots} slots available
      </p>
    )}
  </div>
</div>

        
        {/* Footer CTA */}
        <div className="p-4 border-t">
          <button
  disabled={!selectedStation || availableSlots === 0}
  onClick={() => {
    if (!selectedStation) return
    navigate(`/booking/${selectedStation.id}/slots`, {
  state: {
    station: selectedStation,
    vehicle: selectedVehicle,
  },
})
  }}
  className={`
    w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2
    ${!selectedStation || availableSlots === 0
      ? "bg-primary/50 cursor-not-allowed"
      : "bg-primary hover:bg-primary/90"}
    text-primary-foreground
  `}
>
  Proceed to Slot Booking
</button>
        </div>
      </div>

    </div>    

      {/* ----------------------------
         MAP AREA (FULL SCREEN)
      ----------------------------- */}
      
      
      <div className="flex-1 relative">
  {userLocation && (
    <MapContainer
      center={userLocation}
      zoom={13}
      className="h-full w-full"
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* USER LOCATION MARKER */}
      <Marker
  position={userLocation}
  icon={userLocationIcon}
/>

      {/* REAL STATION MARKERS */}
      {filteredStations.map(station => (
  <Marker
    key={station.id}
    position={[
      Number(station.latitude),
      Number(station.longitude),
    ]}
    eventHandlers={{
      click: () => {
        setSelectedStation(station)
      },
    }}
  />
))}
    </MapContainer>
  )}
</div>
          {vehicleDialogOpen && (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40">

    <div className="bg-card w-full max-w-md rounded-2xl shadow-lg p-6 space-y-5">

      <h2 className="text-lg font-semibold">
        Select Vehicle
      </h2>

      {/* VEHICLE LIST */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {vehicles.map(v => (
          <div
            key={v.id}
            onClick={() => setTempVehicle(v)}
            className={`p-4 rounded-xl border cursor-pointer transition
              ${tempVehicle?.id === v.id
                ? "border-primary bg-accent"
                : "hover:bg-muted"}`}
          >
            <p className="font-medium">
              {v.brand} {v.model}
            </p>
            <p className="text-sm text-muted-foreground">
              {v.car_number} · {v.charger_type}
            </p>
          </div>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={() => setVehicleDialogOpen(false)}
          className="px-4 py-2 rounded-lg border text-sm hover:bg-muted"
        >
          Cancel
        </button>

        <button
          disabled={!tempVehicle}
          onClick={() => {
  if (!tempVehicle) return

  setSelectedVehicle(tempVehicle)
  filterStationsByVehicle(tempVehicle)
  setVehicleDialogOpen(false)
}}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
        >
          Confirm
        </button>
      </div>

    </div>
  </div>
    
)}

    </div>
    
 )
};


export default BookingPage;
