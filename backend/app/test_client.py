import asyncio
import websockets
import cv2
import numpy as np
import base64
import json

async def trigger_ai():
    uri = "ws://localhost:8000/ws/stream"
    print(f"🔌 Attempting connection to {uri}...")
    
    try:
        async with websockets.connect(uri) as ws:
            print("🟢 WebSocket Connected Successfully!")
            
            # 1. Create a dummy image (256x256 grey square)
            print("🎨 Generating dummy frame...")
            dummy_frame = np.full((256, 256, 3), 128, dtype=np.uint8)
            
            # 2. Encode to Base64 (exactly how the React frontend will do it)
            _, buffer = cv2.imencode('.jpg', dummy_frame)
            base64_string = base64.b64encode(buffer).decode('utf-8')
            
            # 3. Fire it at the server
            print("📤 Sending frame to FastAPI...")
            await ws.send(base64_string)
            
            # 4. Wait for the PyTorch Brain
            print("⏳ Waiting for ML Engine...")
            response = await ws.recv()
            
            # 5. Parse and prettify the result
            parsed = json.loads(response)
            
            # Truncate the giant image string so we can actually read the terminal
            if "heatmap_base64" in parsed:
                parsed["heatmap_base64"] = f"{parsed['heatmap_base64'][:30]}... [IMAGE DATA TRUNCATED]"
                
            print("\n🎯 THE AI HAS SPOKEN:")
            print(json.dumps(parsed, indent=4))
            
    except ConnectionRefusedError:
        print("🔴 ERROR: Connection refused. Is your Uvicorn server running?")

if __name__ == "__main__":
    asyncio.run(trigger_ai())