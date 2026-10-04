"""Bi-guay-Di FastAPI Micro-Connector for BYD Cloud Telemetry.
Runs 100% free on cloud platforms (Render, Railway, Fly.io, or local Docker).
Read-only: fetches real-time battery, range, odometer, tire pressure and consumption.
"""

from __future__ import annotations
import asyncio
from datetime import datetime, timezone
import os
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pybyd import BydClient, BydConfig

app = FastAPI(title="Bi-guay-Di BYD Connector", version="2.0.0")

# Allow requests from GitHub Pages and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted via optional custom auth token
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectRequest(BaseModel):
    username: str
    password: str
    country_code: str = "ES"

class FetchRequest(BaseModel):
    username: str
    password: str
    vin: Optional[str] = None
    country_code: str = "ES"

def _client_config(username: str, password: str, country_code: str = "ES") -> BydConfig:
    return BydConfig(
        username=username.strip(),
        password=password,
        country_code=country_code.upper(),
        language="es",
        time_zone="Europe/Madrid",
        mqtt_enabled=False,
    )

def _clean_data(val: Any) -> Any:
    """Recursively clean pydantic models or dicts, dropping GPS coordinates for privacy."""
    blocked = {"latitude", "longitude", "gps", "gpsinfo", "gps_info", "lat", "lng", "lon"}
    if hasattr(val, "model_dump"):
        val = val.model_dump(mode="json", exclude_none=True)
    if isinstance(val, dict):
        return {
            k: _clean_data(v)
            for k, v in val.items()
            if k.lower() not in blocked and "gps" not in k.lower() and "location" not in k.lower() and v is not None
        }
    if isinstance(val, (list, tuple)):
        return [_clean_data(item) for item in val]
    if isinstance(val, datetime):
        return val.astimezone(timezone.utc).isoformat()
    return val

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Bi-guay-Di Micro-Connector",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read_only": True
    }

@app.post("/api/vehicles")
async def list_vehicles(req: ConnectRequest):
    """Log in to BYD cloud and return list of registered vehicles."""
    try:
        config = _client_config(req.username, req.password, req.country_code)
        async with BydClient(config) as client:
            await client.login()
            raw_vehicles = await client.get_vehicles()
            vehicles = []
            for v in raw_vehicles:
                data = _clean_data(v)
                vin = str(data.get("vin") or "")
                name = str(data.get("model_name") or data.get("modelName") or "BYD Dolphin Surf")
                if vin:
                    vehicles.append({"vin": vin, "name": name, "raw": data})
            
            if not vehicles:
                raise HTTPException(status_code=404, detail="No se encontraron vehículos en esta cuenta BYD.")
            
            return {"success": True, "count": len(vehicles), "vehicles": vehicles}
    except Exception as exc:
        err = str(exc).lower()
        if "auth" in err or "password" in err or "3008" in err:
            raise HTTPException(status_code=401, detail="Usuario o contraseña de BYD incorrectos.")
        raise HTTPException(status_code=502, detail=f"Error al conectar con la nube BYD: {str(exc)}")

@app.post("/api/telemetry")
async def get_telemetry(req: FetchRequest):
    """Fetch current snapshot (realtime status & energy consumption) for vehicle."""
    try:
        config = _client_config(req.username, req.password, req.country_code)
        async with BydClient(config) as client:
            await client.login()
            vehicles = await client.get_vehicles()
            
            target = None
            if req.vin:
                for v in vehicles:
                    cleaned = _clean_data(v)
                    if cleaned.get("vin") == req.vin:
                        target = v
                        break
            if not target and vehicles:
                target = vehicles[0]
            
            if not target:
                raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
            
            # Fetch realtime data and energy metrics
            realtime_raw = await target.get_realtime_data()
            energy_raw = await target.get_energy_consumption()

            realtime = _clean_data(realtime_raw)
            energy = _clean_data(energy_raw)

            return {
                "success": True,
                "vin": _clean_data(target).get("vin"),
                "capturedAt": datetime.now(timezone.utc).isoformat(),
                "realtime": realtime,
                "energy": energy
            }
    except Exception as exc:
        err = str(exc).lower()
        if "auth" in err or "password" in err:
            raise HTTPException(status_code=401, detail="Error de autenticación con BYD.")
        raise HTTPException(status_code=502, detail=f"Error consultando telemetría BYD: {str(exc)}")
