let loadPromise = null;

export function loadGoogleMapsApi(apiKey) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps는 웹에서만 사용할 수 있습니다.'));
  }
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API 키가 비어 있습니다.'));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ko&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps 초기화 실패'));
    };
    script.onerror = () => reject(new Error('Google Maps 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
