import aiohttp
import json
import logging
import io
import uuid
import time
import qrcode
from urllib.parse import urlparse
from typing import Optional, Dict, Any, List, Tuple
from bot.config import config

logger = logging.getLogger(__name__)


class XUIClient:
    """
    Asynchronous 3x-ui / X-UI Panel API Client.
    Supports inbounds query, client creation, updating, deletion, and config string generation.
    """
    def __init__(self,
                 base_url: str = config.XUI_URL,
                 username: str = config.XUI_USERNAME,
                 password: str = config.XUI_PASSWORD,
                 web_base_path: str = config.XUI_WEB_BASE_PATH):
        self.raw_base_url = base_url.rstrip("/")
        self.web_base_path = web_base_path.strip("/")
        if self.web_base_path:
            self.base_url = f"{self.raw_base_url}/{self.web_base_path}"
        else:
            self.base_url = self.raw_base_url
        self.username = username
        self.password = password
        self.session: Optional[aiohttp.ClientSession] = None
        self._is_logged_in = False
        self.server_host = urlparse(self.raw_base_url).hostname or "127.0.0.1"

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=20)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    async def login(self) -> bool:
        """Authenticate with the 3x-ui panel and retain cookie."""
        try:
            session = await self._get_session()
            login_url = f"{self.base_url}/login"
            payload = {
                "username": self.username,
                "password": self.password
            }
            async with session.post(login_url, json=payload, ssl=False) as resp:
                data = await resp.json()
                if resp.status == 200 and data.get("success"):
                    self._is_logged_in = True
                    logger.info("Successfully authenticated with 3x-ui panel.")
                    return True
                else:
                    logger.warning(f"3x-ui login failed: {data.get('msg')}")
                    return False
        except Exception as e:
            logger.error(f"Error connecting to 3x-ui panel at {self.base_url}: {e}")
            return False

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Internal helper with auto-relogin handling."""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with session.request(method, url, ssl=False, **kwargs) as resp:
                if resp.status in (401, 403) or "login" in str(resp.url).lower():
                    # Session expired, re-login
                    if await self.login():
                        async with session.request(method, url, ssl=False, **kwargs) as retry_resp:
                            return await retry_resp.json()
                return await resp.json()
        except Exception as e:
            # Try login once if not logged in
            logger.warning(f"Request failed to {url}, attempting relogin: {e}")
            if await self.login():
                async with session.request(method, url, ssl=False, **kwargs) as retry_resp:
                    return await retry_resp.json()
            raise

    async def get_inbounds(self) -> List[Dict[str, Any]]:
        """Fetch all inbounds configured in 3x-ui."""
        try:
            res = await self._request("GET", "/panel/api/inbounds/list")
            if res.get("success"):
                return res.get("obj", [])
            return []
        except Exception as e:
            logger.error(f"Failed to fetch inbounds: {e}")
            return []

    async def get_suitable_inbound(self, protocol_hint: str) -> Optional[Dict[str, Any]]:
        """Find an inbound matching the protocol or fallback to first active inbound."""
        inbounds = await self.get_inbounds()
        if not inbounds:
            return None
        
        protocol_lower = protocol_hint.lower()
        # Look for matching protocol
        for inbound in inbounds:
            inbound_proto = inbound.get("protocol", "").lower()
            if "wireguard" in protocol_lower and "wireguard" in inbound_proto:
                return inbound
            elif "reality" in protocol_lower and inbound_proto == "vless":
                return inbound
            elif "vless" in protocol_lower and inbound_proto == "vless":
                return inbound
            elif "vmess" in protocol_lower and inbound_proto == "vmess":
                return inbound
            elif "trojan" in protocol_lower and inbound_proto == "trojan":
                return inbound

        # Fallback to first available inbound
        return inbounds[0]

    async def add_client(self, inbound_id: int, email: str, client_uuid: str,
                         total_gb: int = 0, expiry_days: int = 0,
                         flow: str = "xtls-rprx-vision") -> Tuple[bool, str]:
        """
        Add a client to a specific inbound.
        total_gb = 0 means unlimited.
        expiry_days = 0 means unlimited.
        """
        try:
            total_bytes = total_gb * 1024 * 1024 * 1024 if total_gb > 0 else 0
            expiry_ms = int((time.time() + (expiry_days * 86400)) * 1000) if expiry_days > 0 else 0
            sub_id = uuid.uuid4().hex[:16]

            client_settings = {
                "id": client_uuid,
                "email": email,
                "limitIp": 2,
                "totalGB": total_bytes,
                "expiryTime": expiry_ms,
                "enable": True,
                "flow": flow,
                "subId": sub_id,
                "tgId": "",
                "reset": 0
            }

            payload = {
                "id": inbound_id,
                "settings": json.dumps({"clients": [client_settings]})
            }

            res = await self._request("POST", "/panel/api/inbounds/addClient", json=payload)
            if res.get("success"):
                logger.info(f"Added client {email} ({client_uuid}) to inbound {inbound_id}")
                return True, "Client created successfully"
            else:
                msg = res.get("msg", "Unknown error adding client")
                logger.error(f"Failed to add client: {msg}")
                return False, msg
        except Exception as e:
            logger.error(f"Exception adding client: {e}")
            return False, str(e)

    async def extend_client(self, inbound_id: int, client_uuid: str, add_gb: int = 0, add_days: int = 0) -> bool:
        """Extend client's quota or expiration date."""
        try:
            inbounds = await self.get_inbounds()
            target_inbound = next((ib for ib in inbounds if ib.get("id") == inbound_id), None)
            if not target_inbound:
                return False

            raw_settings = target_inbound.get("settings", "{}")
            settings = json.loads(raw_settings) if isinstance(raw_settings, str) else raw_settings
            clients = settings.get("clients", [])
            target_client = next((c for c in clients if c.get("id") == client_uuid), None)
            if not target_client:
                return False

            # Update traffic
            if add_gb > 0:
                current_total = target_client.get("totalGB", 0)
                add_bytes = add_gb * 1024 * 1024 * 1024
                target_client["totalGB"] = (current_total + add_bytes) if current_total > 0 else add_bytes

            # Update expiry
            if add_days > 0:
                current_expiry = target_client.get("expiryTime", 0)
                now_ms = int(time.time() * 1000)
                base_time = max(now_ms, current_expiry) if current_expiry > 0 else now_ms
                target_client["expiryTime"] = base_time + (add_days * 86400 * 1000)

            payload = {
                "id": inbound_id,
                "settings": json.dumps({"clients": [target_client]})
            }
            res = await self._request("POST", f"/panel/api/inbounds/updateClient/{client_uuid}", json=payload)
            return bool(res.get("success"))
        except Exception as e:
            logger.error(f"Error extending client {client_uuid}: {e}")
            return False

    async def delete_client(self, inbound_id: int, client_uuid: str) -> bool:
        """Delete client from an inbound."""
        try:
            res = await self._request("POST", f"/panel/api/inbounds/{inbound_id}/delClient/{client_uuid}")
            return bool(res.get("success"))
        except Exception as e:
            logger.error(f"Error deleting client {client_uuid}: {e}")
            return False

    def build_config_string(self, inbound: Dict[str, Any], client_uuid: str, email: str, custom_host: Optional[str] = None) -> str:
        """
        Builds standard connection URI string for VLESS (Reality/WS), Trojan, VMess, or WireGuard.
        """
        host = custom_host or self.server_host
        port = inbound.get("port", 443)
        protocol = inbound.get("protocol", "vless").lower()
        remark = f"{inbound.get('remark', 'VPN')}-{email}"

        raw_stream = inbound.get("streamSettings", "{}")
        stream = json.loads(raw_stream) if isinstance(raw_stream, str) else raw_stream
        security = stream.get("security", "none")
        network = stream.get("network", "tcp")

        if protocol == "vless":
            params = [f"type={network}"]
            if security == "reality":
                reality_settings = stream.get("realitySettings", {}).get("settings", {})
                pbk = reality_settings.get("publicKey", "")
                server_names = stream.get("realitySettings", {}).get("serverNames", ["zoom.us"])
                sni = server_names[0] if server_names else "zoom.us"
                short_ids = stream.get("realitySettings", {}).get("shortIds", [""])
                sid = short_ids[0] if short_ids else ""
                params.extend([
                    "security=reality",
                    f"pbk={pbk}",
                    "fp=chrome",
                    f"sni={sni}",
                    f"sid={sid}",
                    "spx=%2F",
                    "flow=xtls-rprx-vision"
                ])
            elif security == "tls":
                params.append("security=tls")
            query = "&".join(params)
            return f"vless://{client_uuid}@{host}:{port}?{query}#{remark}"

        elif protocol == "vmess":
            vmess_meta = {
                "v": "2",
                "ps": remark,
                "add": host,
                "port": str(port),
                "id": client_uuid,
                "aid": "0",
                "scy": "auto",
                "net": network,
                "type": "none",
                "host": "",
                "path": "",
                "tls": security
            }
            import base64
            encoded = base64.b64encode(json.dumps(vmess_meta).encode("utf-8")).decode("utf-8")
            return f"vmess://{encoded}"

        elif protocol == "trojan":
            return f"trojan://{client_uuid}@{host}:{port}?security={security}#{remark}"

        elif protocol == "wireguard":
            # Wireguard client sample profile
            return (
                f"[Interface]\n"
                f"PrivateKey = <GENERATED_CLIENT_KEY>\n"
                f"Address = 10.0.0.2/32\n"
                f"DNS = 1.1.1.1, 8.8.8.8\n\n"
                f"[Peer]\n"
                f"PublicKey = <SERVER_PUBLIC_KEY>\n"
                f"Endpoint = {host}:{port}\n"
                f"AllowedIPs = 0.0.0.0/0\n"
                f"PersistentKeepalive = 25\n"
            )

        # Fallback generic format
        return f"vless://{client_uuid}@{host}:{port}?type=tcp#{remark}"

    def generate_qr_bytes(self, content: str) -> io.BytesIO:
        """Generate high-res QR code PNG image as in-memory stream."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=3,
        )
        qr.add_data(content)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        bio = io.BytesIO()
        bio.name = "vpn_config_qr.png"
        img.save(bio, "PNG")
        bio.seek(0)
        return bio


xui_client = XUIClient()
