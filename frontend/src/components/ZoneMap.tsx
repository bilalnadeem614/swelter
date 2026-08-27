import { useEffect, useState } from "react"
import { MapContainer, TileLayer, LayersControl, CircleMarker, Popup, useMap } from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchZones, fetchLatestDecisions, type Zone, type Decision, type Action } from "@/lib/api"

const ACTION_COLOR: Record<Action, string> = {
  none: "#22c55e",
  alert: "#eab308",
  reschedule: "#f97316",
  escalate: "#ef4444",
}

const ZOOM_ON_CLICK = 18

function ZoneMarkers({
  zones,
  latestByZone,
  onZoneClick,
}: {
  zones: Zone[]
  latestByZone: Record<string, Decision>
  onZoneClick: (zoneId: string) => void
}) {
  const map = useMap()

  return (
    <>
      {zones.map((zone) => {
        const action = latestByZone[zone.id]?.action ?? "none"
        return (
          <CircleMarker
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={10}
            pathOptions={{ color: ACTION_COLOR[action], fillColor: ACTION_COLOR[action], fillOpacity: 0.8 }}
            eventHandlers={{
              click: () => {
                map.flyTo([zone.lat, zone.lng], ZOOM_ON_CLICK)
                onZoneClick(zone.id)
              },
            }}
          >
            <Popup>{zone.name}</Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}

export function ZoneMap({ onZoneClick }: { onZoneClick: (zoneId: string) => void }) {
  const [zones, setZones] = useState<Zone[] | null>(null)
  const [latestByZone, setLatestByZone] = useState<Record<string, Decision>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchZones(), fetchLatestDecisions()])
      .then(([zoneRows, decisionRows]) => {
        setZones(zoneRows)
        setLatestByZone(Object.fromEntries(decisionRows.map((d) => [d.zone_id, d])))
      })
      .catch((err) => setError(err.message))
  }, [])

  const bounds: LatLngBoundsExpression | undefined = zones?.length
    ? zones.map((z) => [z.lat, z.lng] as [number, number])
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Zones</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !zones && <Skeleton className="h-[400px] w-full rounded-lg" />}
        {zones && bounds && (
          <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [40, 40] }}
            style={{ height: 400, width: "100%", borderRadius: "var(--radius-lg)" }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Street">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            <ZoneMarkers zones={zones} latestByZone={latestByZone} onZoneClick={onZoneClick} />
          </MapContainer>
        )}
      </CardContent>
    </Card>
  )
}
