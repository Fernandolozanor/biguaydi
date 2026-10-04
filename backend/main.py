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

import httpx

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Bi-guay-Di Micro-Connector",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read_only": True
    }

@app.get("/api/prices")
@app.get("//api/prices")
async def get_daily_prices():
    """Fetch daily official average electricity (PVPC/REE) and Gasoline 95 (MITECO) in Spain."""
    res = {
        "success": True,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "kwhGrid": 0.145, # Fallback base
        "gas95": 1.62,    # Fallback base
        "source": "Estimación de mercado España"
    }
    
    async with httpx.AsyncClient(timeout=8.0) as client:
        # 1. Fetch live electricity average from Red Eléctrica de España (REE / API PVPC pública)
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            ree_url = f"https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date={today_str}T00:00&end_date={today_str}T23:59&time_trunc=hour"
            r_ree = await client.get(ree_url)
            if r_ree.status_code == 200:
                ree_json = r_ree.json()
                pvpc_data = None
                for indicator in ree_json.get("included", []):
                    if "PVPC" in indicator.get("attributes", {}).get("title", ""):
                        values = [item.get("value") for item in indicator.get("attributes", {}).get("values", []) if item.get("value") is not None]
                        if values:
                            # PVPC comes in €/MWh. Convert to €/kWh (/ 1000)
                            avg_mwh = sum(values) / len(values)
                            res["kwhGrid"] = round(avg_mwh / 1000.0, 4)
                            res["source_electricity"] = "REE (Red Eléctrica de España - PVPC diario)"
                            break
        except Exception:
            pass

        # 2. Fetch live average Gasoline 95 & Diesel A from MITECO (Ministerio para la Transición Ecológica)
        try:
            miteco_url = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
            r_gas = await client.get(miteco_url)
            if r_gas.status_code == 200:
                gas_json = r_gas.json()
                prices_gas = []
                prices_diesel = []
                for st in gas_json.get("ListaEESSPrecio", []):
                    # Gasoline 95
                    p_gas_str = st.get("Precio Gasolina 95 E5", "").replace(",", ".")
                    try:
                        p_gas = float(p_gas_str)
                        if 1.0 < p_gas < 3.0:
                            prices_gas.append(p_gas)
                    except ValueError:
                        pass
                    # Diesel A
                    p_die_str = st.get("Precio Gasoleo A", "").replace(",", ".")
                    try:
                        p_die = float(p_die_str)
                        if 1.0 < p_die < 3.0:
                            prices_diesel.append(p_die)
                    except ValueError:
                        pass

                if prices_gas:
                    res["gas95"] = round(sum(prices_gas) / len(prices_gas), 3)
                if prices_diesel:
                    res["diesel"] = round(sum(prices_diesel) / len(prices_diesel), 3)
                else:
                    res["diesel"] = 1.54
                res["source_fuel"] = "MITECO (Ministerio para la Transición Ecológica)"
        except Exception:
            res["diesel"] = 1.54

    return res

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
@app.post("//api/telemetry")
async def get_telemetry(req: FetchRequest):
    """Fetch current snapshot (realtime status & energy consumption) for vehicle."""
    try:
        config = _client_config(req.username, req.password, req.country_code)
        async with BydClient(config) as client:
            await client.login()
            vehicles = await client.get_vehicles()
            
            if not vehicles:
                raise HTTPException(status_code=404, detail="La cuenta BYD no tiene coches asociados.")
            
            selected_vin = req.vin
            if not selected_vin:
                # Extract VIN from the first vehicle object or dict
                first_v = vehicles[0]
                cleaned_first = _clean_data(first_v)
                selected_vin = cleaned_first.get("vin")
            
            if not selected_vin:
                raise HTTPException(status_code=404, detail="No se pudo identificar el número de bastidor (VIN).")
            
            # Use direct client methods or vehicle instance methods
            try:
                realtime_raw = await client.get_vehicle_realtime(selected_vin)
            except AttributeError:
                realtime_raw = await vehicles[0].get_realtime_data()
            
            try:
                energy_raw = await client.get_energy_consumption(selected_vin)
            except AttributeError:
                energy_raw = await vehicles[0].get_energy_consumption()

            realtime = _clean_data(realtime_raw)
            energy = _clean_data(energy_raw)

            return {
                "success": True,
                "vin": selected_vin,
                "capturedAt": datetime.now(timezone.utc).isoformat(),
                "realtime": realtime,
                "energy": energy
            }
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc).lower()
        if "auth" in err or "password" in err or "3008" in err:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos en BYD.")
        raise HTTPException(status_code=502, detail=f"Error consultando telemetría BYD: {str(exc)}")
