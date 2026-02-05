(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const recordings = /* @__PURE__ */ new Map();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});
async function handleMessage(message) {
  switch (message.action) {
    case "startRecording":
      return handleStartRecording(message);
    case "stopRecording":
      return handleStopRecording(message);
    case "isRecording":
      return handleIsRecording(message);
    case "cancelRecording":
      return handleCancelRecording(message);
    default:
      return { success: false, error: "Unknown action" };
  }
}
async function handleStartRecording(params) {
  const { tabId } = params;
  if (recordings.has(tabId)) {
    return { success: false, error: `Recording already in progress for tab ${tabId}` };
  }
  try {
    const audioConstraints = params.audio ? {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: params.streamId
      }
    } : false;
    const videoConstraints = {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: params.streamId,
        minFrameRate: params.frameRate || 30,
        maxFrameRate: params.frameRate || 30
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: videoConstraints
    });
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/mp4",
      videoBitsPerSecond: params.videoBitsPerSecond || 25e5,
      audioBitsPerSecond: params.audioBitsPerSecond || 128e3
    });
    const startedAt = Date.now();
    recordings.set(tabId, {
      recorder,
      stream,
      startedAt,
      tabId
    });
    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const arrayBuffer = await event.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        chrome.runtime.sendMessage({
          action: "recordingChunk",
          tabId,
          data: Array.from(uint8Array)
          // Convert to regular array for message passing
        });
      }
    };
    recorder.onerror = (event) => {
      console.error(`MediaRecorder error for tab ${tabId}:`, event.error);
      handleCancelRecordingForTab(tabId);
    };
    recorder.onstop = () => {
      console.log(`MediaRecorder stopped for tab ${tabId}`);
    };
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MediaRecorder failed to start within 5 seconds"));
      }, 5e3);
      recorder.onstart = () => {
        clearTimeout(timeout);
        console.log(`MediaRecorder started for tab ${tabId}`);
        resolve();
      };
      recorder.start(1e3);
    });
    return { success: true, tabId, startedAt, mimeType: "video/mp4" };
  } catch (error) {
    console.error(`Failed to start recording for tab ${tabId}:`, error);
    return { success: false, error: error.message };
  }
}
async function handleStopRecording(params) {
  const { tabId } = params;
  const recording = recordings.get(tabId);
  if (!recording) {
    return { success: false, error: `No active recording for tab ${tabId}` };
  }
  try {
    const { recorder, stream, startedAt } = recording;
    await new Promise((resolve) => {
      const originalOnStop = recorder.onstop;
      recorder.onstop = (event) => {
        if (originalOnStop) {
          originalOnStop.call(recorder, event);
        }
        resolve();
      };
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve();
      }
    });
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    const duration = Date.now() - startedAt;
    chrome.runtime.sendMessage({
      action: "recordingChunk",
      tabId,
      final: true
    });
    recordings.delete(tabId);
    return { success: true, tabId, duration };
  } catch (error) {
    console.error(`Failed to stop recording for tab ${tabId}:`, error);
    return { success: false, error: error.message };
  }
}
function handleIsRecording(params) {
  var _a;
  const { tabId } = params;
  const recording = recordings.get(tabId);
  if (!recording) {
    return { isRecording: false, tabId };
  }
  return {
    isRecording: ((_a = recording.recorder) == null ? void 0 : _a.state) === "recording",
    tabId,
    startedAt: recording.startedAt
  };
}
function handleCancelRecording(params) {
  const { tabId } = params;
  return handleCancelRecordingForTab(tabId);
}
function handleCancelRecordingForTab(tabId) {
  const recording = recordings.get(tabId);
  if (!recording) {
    return { success: true, tabId };
  }
  try {
    const { recorder, stream } = recording;
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    chrome.runtime.sendMessage({
      action: "recordingCancelled",
      tabId
    });
    recordings.delete(tabId);
    return { success: true, tabId };
  } catch (error) {
    console.error(`Failed to cancel recording for tab ${tabId}:`, error);
    return { success: false, error: error.message };
  }
}
console.log("Playwriter offscreen document loaded");
