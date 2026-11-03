export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new HttpError(response.status, `HTTP Error ${response.status} at ${url}`);
  }
  return response.json();
}

// Завантаження зображення через огортання в Promise
export function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    const img = new Image();
    
    const onAbort = () => {
      img.src = "";
      reject(signal.reason);
    };

    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    img.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(img);
    };

    img.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new Error(`Не вдалося завантажити зображення: ${url}`));
    };

    img.src = url;
  });
}

// Завантаження та декодування аудіо через Web Audio API
export async function loadAudio(audioCtx, url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new HttpError(response.status, `HTTP Error ${response.status} at ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  // Декодуємо буфер у пам'ять для відтворення з нульовою затримкою
  return await audioCtx.decodeAudioData(arrayBuffer);
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const id = setTimeout(resolve, ms);
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  }
});

export async function withRetry(fn, { attempts = 3, baseMs = 500, signal } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted) throw err;
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
        throw err;
      }
      if (i === attempts - 1) throw err;
      const delay = baseMs * (2 ** i) + Math.random() * 100;
      await wait(delay, signal);
    }
  }
}

// Завантаження всіх ресурсів з маніфесту
export async function loadAll(manifest, audioCtx, { onProgress, signal } = {}) {
  let done = 0;
  const images = manifest.images || [];
  const sounds = manifest.sounds || [];
  const data = manifest.data || [];
  
  const allUrls = [
    ...images.map(url => ({ type: 'image', url })),
    ...sounds.map(url => ({ type: 'sound', url })),
    ...data.map(url => ({ type: 'data', url }))
  ];

  const total = allUrls.length;
  if (total === 0) return { images: {}, sounds: {}, data: {} };

  const assets = { images: {}, sounds: {}, data: {} };

  // Додаємо штучну розстрочку по часу (индекс * 500мс), щоб файли «доїздили» по черзі
  const promises = allUrls.map((item, index) => {
    const loadTask = async () => {
      let result;
      if (item.type === 'image') {
        result = await withRetry(() => loadImage(item.url, signal), { signal });
        assets.images[item.url] = result;
      } else if (item.type === 'sound') {
        result = await withRetry(() => loadAudio(audioCtx, item.url, signal), { signal });
        assets.sounds[item.url] = result;
      } else {
        result = await withRetry(() => fetchJson(item.url, signal), { signal });
        assets.data[item.url] = result;
      }

      // Пауза, яка зростає для кожного наступного файла
      await wait((index + 1) * 500, signal);

      done++;
      if (onProgress) onProgress(done / total);
      return result;
    };

    return loadTask();
  });

  await Promise.all(promises);

  // Невелика фінальна затримка перед стартом гри (щоб встигнути побачити 100%)
  await wait(400, signal);

  return assets;
}