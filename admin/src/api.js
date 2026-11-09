import axios from 'axios';

const http = axios.create({
  baseURL: '/api'
});

export const api = {
  trips: {
    list: () => http.get('/trips').then((r) => r.data),
    get: (id) => http.get(`/trips/${id}`).then((r) => r.data),
    create: (body) => http.post('/trips', body).then((r) => r.data),
    update: (id, body) => http.put(`/trips/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/trips/${id}`),
    schedules: (id) => http.get(`/trips/${id}/schedules`).then((r) => r.data)
  },
  schedules: {
    saveItems: (id, items) => http.put(`/schedules/${id}/items`, items).then((r) => r.data)
  },
  places: {
    list: () => http.get('/places').then((r) => r.data),
    create: (body) => http.post('/places', body).then((r) => r.data),
    update: (id, body) => http.put(`/places/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/places/${id}`)
  },
  vouchers: {
    list: (tripId) => http.get('/vouchers', { params: { tripId } }).then((r) => r.data),
    create: (body) => http.post('/vouchers', body).then((r) => r.data),
    update: (id, body) => http.put(`/vouchers/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/vouchers/${id}`)
  },
  phrases: {
    list: (tripId) => http.get('/phrases', { params: { tripId } }).then((r) => r.data),
    create: (body) => http.post('/phrases', body).then((r) => r.data),
    update: (id, body) => http.put(`/phrases/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/phrases/${id}`)
  },
  packing: {
    list: (tripId) => http.get('/packing-items', { params: { tripId } }).then((r) => r.data),
    create: (body) => http.post('/packing-items', body).then((r) => r.data),
    update: (id, body) => http.put(`/packing-items/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/packing-items/${id}`)
  }
};
