async function checkVideo() {
  const url = 'https://www.w3schools.com/html/mov_bbb.mp4';
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    console.log("Content-Length:", res.headers.get('content-length'));
  } catch(e) {
    console.error("Error:", e);
  }
}
checkVideo();
