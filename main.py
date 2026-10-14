import os
import json
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from thefuzz import process

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

MOVIES_CATALOG = [
    {
        "id": "m1",
        "title": "Oceans Exploration",
        "category": "Nature",
        "poster": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",
        "url": "https://vjs.zencdn.net/v/oceans.mp4"
    },
    {
        "id": "m2",
        "title": "Sintel Fantasy Trailer",
        "category": "Fantasy",
        "poster": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop",
        "url": "https://media.w3.org/2010/05/sintel/trailer.mp4"
    },
    {
        "id": "m3",
        "title": "Cosmic Flower",
        "category": "Sci-Fi",
        "poster": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop",
        "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    },
    {
        "id": "m4",
        "title": "Big Buck Bunny Movie",
        "category": "Animation",
        "poster": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop",
        "url": "https://vjs.zencdn.net/v/oceans.mp4"
    },
    {
        "id": "m5",
        "title": "Bunny Trailer Short",
        "category": "Adventure",
        "poster": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&auto=format&fit=crop",
        "url": "https://media.w3.org/2010/05/bunny/trailer.mp4"
    },
    {
        "id": "m6",
        "title": "HD Sample Stream",
        "category": "Fantasy",
        "poster": "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=500&auto=format&fit=crop",
        "url": "https://media.w3.org/2010/05/sintel/trailer.mp4"
    },
    {
        "id": "m7",
        "title": "Classic Bunny Clip",
        "category": "Comedy",
        "poster": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop",
        "url": "https://www.w3schools.com/html/mov_bbb.mp4"
    },
    {
        "id": "m8",
        "title": "City Bicycle Stream",
        "category": "Sci-Fi",
        "poster": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop",
        "url": "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/person-bicycle-car-detection.mp4"
    },
    {
        "id": "m9",
        "title": "Action Test Stream",
        "category": "Action",
        "poster": "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=500&auto=format&fit=crop",
        "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    },
    {
        "id": "m10",
        "title": "Store Walkthrough",
        "category": "Documentary",
        "poster": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",
        "url": "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/store-aisle-detection.mp4"
    }
]

rooms = {}

@app.get("/")
async def get_index(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/api/movies")
async def get_movies(search: str = "", category: str = "All"):
    results = MOVIES_CATALOG
    if category != "All":
        results = [m for m in results if m["category"] == category]
    if search.strip():
        titles = [m["title"] for m in results]
        matches = process.extract(search, titles, limit=10)
        matched_titles = [m[0] for m in matches if m[1] > 35]
        results = [m for m in results if m["title"] in matched_titles]
    return {"movies": results}

@app.websocket("/ws/{room_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, username: str):
    await websocket.accept()
    
    if room_id not in rooms:
        rooms[room_id] = {}
        
    # Strict 10-person room capacity cap
    if len(rooms[room_id]) >= 10:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Room is full! Maximum 10 participants allowed."
        }))
        await websocket.close()
        return

    rooms[room_id][websocket] = username
    
    users = list(rooms[room_id].values())
    update_msg = json.dumps({"type": "user_update", "users": users})
    for ws in rooms[room_id]:
        await ws.send_text(update_msg)

    join_msg = json.dumps({"type": "chat", "user": "System", "text": f"{username} joined the party! 💕 ({len(users)}/10)", "side": "left"})
    for ws in rooms[room_id]:
        await ws.send_text(join_msg)

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            payload["user"] = username
            
            msg_str = json.dumps(payload)
            for ws in rooms[room_id]:
                if ws != websocket or payload.get("type") in ["chat", "reaction"]:
                    await ws.send_text(msg_str)
                    
    except WebSocketDisconnect:
        if websocket in rooms[room_id]:
            del rooms[room_id][websocket]
        if not rooms[room_id]:
            del rooms[room_id]
        else:
            users = list(rooms[room_id].values())
            leave_msg = json.dumps({"type": "user_update", "users": users})
            for ws in rooms[room_id]:
                await ws.send_text(leave_msg)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)