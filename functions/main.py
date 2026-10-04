"""Bi-guay-Di Firebase backend.

BYD access is deliberately read-only. BYD credentials are encrypted with
Cloud KMS before persistence; no command/control PIN is accepted here.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
from datetime import UTC, datetime
from typing import Any

import firebase_admin
from firebase_admin import auth, firestore
from firebase_functions import https_fn, options, params
from google.cloud import kms_v1
from pybyd import BydClient, BydConfig

REGION = "europe-west1"
APP_UID_PEPPER = params.SecretParam("APP_UID_PEPPER")
KMS_KEY_NAME = os.environ.get("KMS_KEY_NAME", "")
ALLOWED_ORIGIN = os.environ.get("BGUAYDI_ALLOWED_ORIGIN", "")

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
kms = kms_v1.KeyManagementServiceClient()


def _https_error(code: https_fn.FunctionsErrorCode, message: str) -> None:
    raise https_fn.HttpsError(code=code, message=message)


def _normalize_username(value: Any) -> str:
    if not isinstance(value, str):
        _https_error(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Revisa el correo o teléfono de BYD.")
    normalized = value.strip().lower()
    if not normalized or len(normalized) > 254:
        _https_error(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Revisa el correo o teléfono de BYD.")
    return normalized


def _uid_for(username: str) -> str:
    pepper = APP_UID_PEPPER.value()
    return hmac.new(pepper.encode(), username.encode(), hashlib.sha256).hexdigest()


def _encrypt_credentials(username: str, password: str, country_code: str) -> str:
    if not KMS_KEY_NAME:
        raise RuntimeError("KMS_KEY_NAME no está configurado.")
    plaintext = json.dumps(
        {"username": username, "password": password, "country_code": country_code},
        separators=(",", ":"),
    ).encode()
    encrypted = kms.encrypt(request={"name": KMS_KEY_NAME, "plaintext": plaintext})
    return base64.b64encode(encrypted.ciphertext).decode("ascii")


def _decrypt_credentials(ciphertext: str) -> dict[str, str]:
    decrypted = kms.decrypt(
        request={"name": KMS_KEY_NAME, "ciphertext": base64.b64decode(ciphertext)}
    )
    data = json.loads(decrypted.plaintext.decode())
    return {"username": data["username"], "password": data["password"], "country_code": data["country_code"]}


def _client_config(credentials: dict[str, str]) -> BydConfig:
    return BydConfig(
        username=credentials["username"],
        password=credentials["password"],
        country_code=credentials.get("country_code", "ES"),
        language="es",
        time_zone="Europe/Madrid",
        mqtt_enabled=False,
    )


def _to_json(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    if isinstance(value, dict):
        return {str(k): _to_json(v) for k, v in value.items() if v is not None}
    if isinstance(value, (list, tuple)):
        return [_to_json(v) for v in value]
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _without_location(value: Any) -> Any:
    """Drop coordinates from snapshots until the user explicitly opts in."""
    blocked = {"latitude", "longitude", "gps", "gpsinfo", "gps_info", "lat", "lng", "lon"}
    if isinstance(value, dict):
        return {
            k: _without_location(v)
            for k, v in value.items()
            if k.lower() not in blocked and "gps" not in k.lower() and "location" not in k.lower()
        }
    if isinstance(value, list):
        return [_without_location(item) for item in value]
    return value


def _check_login_rate(uid: str) -> None:
    ref = db.collection("_loginLimits").document(uid)
    now = datetime.now(UTC)
    snapshot = ref.get()
    attempts = snapshot.to_dict().get("attempts", []) if snapshot.exists else []
    recent = [stamp for stamp in attempts if (now - stamp).total_seconds() < 900]
    if len(recent) >= 5:
        _https_error(https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED, "Demasiados intentos. Espera 15 minutos antes de volver a probar.")
    ref.set({"attempts": [*recent, now]}, merge=True)


def _vehicle_summary(vehicle: Any) -> dict[str, Any]:
    data = _to_json(vehicle)
    return {
        "vin": str(data.get("vin") or ""),
        "name": str(data.get("model_name") or data.get("modelName") or data.get("vehicle_name") or "BYD"),
        "model": str(data.get("model_name") or data.get("modelName") or ""),
    }


def _allowed_cors() -> options.CorsOptions:
    # A caller must set this to its exact GitHub Pages/custom-domain origin.
    origins = [origin.strip() for origin in ALLOWED_ORIGIN.split(",") if origin.strip()]
    if not origins:
        origins = ["https://localhost"]
    return options.CorsOptions(cors_origins=origins, cors_methods=["post"])


def _require_uid(req: https_fn.CallableRequest) -> str:
    if not req.auth:
        _https_error(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Inicia sesión para continuar.")
    return req.auth.uid


def _credentials_doc(uid: str) -> firestore.DocumentReference:
    return db.collection("bydConnections").document(uid)


def _require_connection(uid: str) -> dict[str, Any]:
    snapshot = _credentials_doc(uid).get()
    if not snapshot.exists:
        _https_error(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Vuelve a conectar tu cuenta BYD.")
    return snapshot.to_dict() or {}


@https_fn.on_call(
    region=REGION,
    cors=_allowed_cors(),
    secrets=[APP_UID_PEPPER],
    max_instances=3,
)
def connect_byd(req: https_fn.CallableRequest) -> dict[str, Any]:
    """Verify BYD credentials, encrypt and save them, then issue app auth."""
    data = req.data if isinstance(req.data, dict) else {}
    username = _normalize_username(data.get("username"))
    password = data.get("password")
    country_code = str(data.get("countryCode") or "ES").upper()
    if not isinstance(password, str) or not password or len(password) > 512:
        _https_error(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Escribe la contraseña de tu cuenta BYD.")
    if country_code != "ES":
        _https_error(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Por ahora la conexión está preparada para España.")
    uid = _uid_for(username)
    _check_login_rate(uid)

    async def verify_account() -> list[dict[str, Any]]:
        async with BydClient(_client_config({"username": username, "password": password, "country_code": country_code})) as client:
            await client.login()
            vehicles = await client.get_vehicles()
            return [_vehicle_summary(vehicle) for vehicle in vehicles if _vehicle_summary(vehicle)["vin"]]

    try:
        vehicles = asyncio.run(verify_account())
    except Exception as exc:  # BYD auth/protocol errors are not safe to expose verbatim.
        detail = str(exc).lower()
        if "auth" in detail or "password" in detail or "3008" in detail:
            _https_error(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "BYD no ha aceptado esos datos. Comprueba el correo y la contraseña.")
        _https_error(https_fn.FunctionsErrorCode.UNAVAILABLE, "BYD no responde ahora. Espera un poco y vuelve a intentarlo.")

    if not vehicles:
        _https_error(https_fn.FunctionsErrorCode.NOT_FOUND, "La cuenta BYD no tiene vehículos disponibles.")

    encrypted_credentials = _encrypt_credentials(username, password, country_code)
    selected_vin = vehicles[0]["vin"] if len(vehicles) == 1 else None
    _credentials_doc(uid).set(
        {
            "credentialsCiphertext": encrypted_credentials,
            "vehicles": vehicles,
            "selectedVin": selected_vin,
            "gpsEnabled": False,
            "connectedAt": firestore.SERVER_TIMESTAMP,
            "lastSyncAt": None,
            "connectionState": "connected",
        },
        merge=True,
    )
    db.collection("_loginLimits").document(uid).delete()
    token = auth.create_custom_token(uid, claims={"bydConnected": True}).decode("utf-8")
    return {"token": token, "vehicles": vehicles, "selectedVin": selected_vin}


@https_fn.on_call(region=REGION, cors=_allowed_cors())
def choose_vehicle(req: https_fn.CallableRequest) -> dict[str, str]:
    uid = _require_uid(req)
    data = req.data if isinstance(req.data, dict) else {}
    vin = str(data.get("vin") or "").strip().upper()
    connection = _require_connection(uid)
    allowed_vins = {str(vehicle.get("vin", "")).upper() for vehicle in connection.get("vehicles", [])}
    if vin not in allowed_vins:
        _https_error(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Elige uno de los vehículos de tu cuenta.")
    _credentials_doc(uid).update({"selectedVin": vin, "connectionState": "connected"})
    return {"selectedVin": vin}


@https_fn.on_call(region=REGION, cors=_allowed_cors())
def get_vehicle_data(req: https_fn.CallableRequest) -> dict[str, Any]:
    uid = _require_uid(req)
    connection = _require_connection(uid)
    vin = connection.get("selectedVin")
    if not vin:
        return {"needsVehicle": True, "vehicles": connection.get("vehicles", [])}
    snapshot = db.collection("vehicleData").document(uid).get()
    latest = snapshot.to_dict() if snapshot.exists else None
    if not latest:
        return {"pending": True, "vehicle": next((v for v in connection.get("vehicles", []) if v.get("vin") == vin), None)}
    return {"pending": False, "vehicle": next((v for v in connection.get("vehicles", []) if v.get("vin") == vin), None), **latest}


@https_fn.on_call(region=REGION, cors=_allowed_cors(), timeout_sec=120)
def refresh_vehicle_data(req: https_fn.CallableRequest) -> dict[str, Any]:
    uid = _require_uid(req)
    connection = _require_connection(uid)
    vin = connection.get("selectedVin")
    if not vin:
        _https_error(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Elige primero tu vehículo.")
    credentials = _decrypt_credentials(connection["credentialsCiphertext"])

    async def fetch() -> tuple[Any, Any]:
        async with BydClient(_client_config(credentials)) as client:
            realtime = await client.get_vehicle_realtime(vin)
            energy = await client.get_energy_consumption(vin)
            return realtime, energy

    try:
        realtime, energy = asyncio.run(fetch())
    except Exception:
        _https_error(https_fn.FunctionsErrorCode.UNAVAILABLE, "BYD no pudo entregar datos ahora. Vuelve a intentarlo en un momento.")
    now = datetime.now(UTC)
    payload = {
        "vin": vin,
        "capturedAt": now,
        "realtime": _without_location(_to_json(realtime)),
        "energy": _without_location(_to_json(energy)),
        "source": "byd-cloud",
    }
    ref = db.collection("vehicleData").document(uid)
    ref.set(payload, merge=True)
    ref.collection("samples").document(now.strftime("%Y%m%dT%H%M%S")).set(payload)
    _credentials_doc(uid).update({"lastSyncAt": now, "connectionState": "connected", "lastError": firestore.DELETE_FIELD})
    return payload


@https_fn.on_call(region=REGION, cors=_allowed_cors())
def disconnect_byd(req: https_fn.CallableRequest) -> dict[str, bool]:
    uid = _require_uid(req)
    # Remove ciphertext, cached telemetry, and every recorded sample/trip.
    db.recursive_delete(_credentials_doc(uid))
    db.recursive_delete(db.collection("vehicleData").document(uid))
    db.recursive_delete(db.collection("driveHistory").document(uid))
    db.collection("_loginLimits").document(uid).delete()
    try:
        auth.delete_user(uid)
    except auth.UserNotFoundError:
        pass
    return {"deleted": True}


def _safe_error(exc: Exception) -> str:
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[cuenta]", str(exc))
    text = re.sub(r"\b[A-HJ-NPR-Z0-9]{17}\b", "[vehículo]", text, flags=re.I)
    return text[:180] or "No se pudo actualizar desde BYD."
