import * as THREE from "three";

// Palette from human-weather/lib/moods.ts (colour = soft fill, ink = saturated).
export const MOODS = [
  { name: "Peaceful", color: "#91dfcc", ink: "#40d4b0" },
  { name: "Hopeful", color: "#c5dc9a", ink: "#a0cd4e" },
  { name: "Happy", color: "#f3cc86", ink: "#f9ad25" },
  { name: "Excited", color: "#f1a17d", ink: "#f6601c" },
  { name: "Lonely", color: "#a29ce4", ink: "#564bda" },
  { name: "Anxious", color: "#c4a0d0", ink: "#a15db8" },
  { name: "Exhausted", color: "#9daec8", ink: "#5d7cac" },
  { name: "Heartbroken", color: "#d39ba9", ink: "#be546f" },
] as const;

const [PEACEFUL, HOPEFUL, HAPPY, EXCITED, LONELY, ANXIOUS, EXHAUSTED, HEARTBROKEN] = [0, 1, 2, 3, 4, 5, 6, 7];

/** Illustrative moods only — not real Human Weather data. */
export const CITIES: { name: string; lat: number; lng: number; mood: number }[] = [
  { name: "Lisbon", lat: 38.7, lng: -9.1, mood: HAPPY },
  { name: "London", lat: 51.5, lng: -0.1, mood: EXHAUSTED },
  { name: "Paris", lat: 48.9, lng: 2.35, mood: HOPEFUL },
  { name: "Berlin", lat: 52.5, lng: 13.4, mood: PEACEFUL },
  { name: "New York", lat: 40.7, lng: -74, mood: ANXIOUS },
  { name: "San Francisco", lat: 37.8, lng: -122.4, mood: EXCITED },
  { name: "Mexico City", lat: 19.4, lng: -99.1, mood: HAPPY },
  { name: "São Paulo", lat: -23.5, lng: -46.6, mood: EXCITED },
  { name: "Buenos Aires", lat: -34.6, lng: -58.4, mood: HEARTBROKEN },
  { name: "Lagos", lat: 6.5, lng: 3.4, mood: HOPEFUL },
  { name: "Cairo", lat: 30, lng: 31.2, mood: EXHAUSTED },
  { name: "Nairobi", lat: -1.3, lng: 36.8, mood: PEACEFUL },
  { name: "Dubai", lat: 25.2, lng: 55.3, mood: EXCITED },
  { name: "Mumbai", lat: 19, lng: 72.8, mood: ANXIOUS },
  { name: "Bangkok", lat: 13.8, lng: 100.5, mood: HAPPY },
  { name: "Shanghai", lat: 31.2, lng: 121.5, mood: HOPEFUL },
  { name: "Beijing", lat: 39.9, lng: 116.4, mood: EXHAUSTED },
  { name: "Tokyo", lat: 35.7, lng: 139.7, mood: LONELY },
  { name: "Seoul", lat: 37.6, lng: 127, mood: ANXIOUS },
  { name: "Sydney", lat: -33.9, lng: 151.2, mood: PEACEFUL },
  { name: "Singapore", lat: 1.35, lng: 103.8, mood: HAPPY },
  { name: "Moscow", lat: 55.8, lng: 37.6, mood: LONELY },
  { name: "Toronto", lat: 43.7, lng: -79.4, mood: PEACEFUL },
  { name: "Cape Town", lat: -33.9, lng: 18.4, mood: HOPEFUL },
];

/** The city the camera dives into for the H3 cells beat. */
export const FOCUS = CITIES.find((c) => c.name === "Shanghai")!;

/** Demo leaderboard (clearly labelled as demo in the UI). */
export const LEADERBOARD = [
  { city: "Lisbon", score: 74 },
  { city: "Bangkok", score: 71 },
  { city: "Mexico City", score: 69 },
];

const D2R = Math.PI / 180;

/** lat/lng → unit vector. (0,0) faces +z, north is +y. */
export function latLng(lat: number, lng: number, out = new THREE.Vector3()) {
  const la = lat * D2R;
  const ln = lng * D2R;
  return out.set(Math.cos(la) * Math.sin(ln), Math.sin(la), Math.cos(la) * Math.cos(ln));
}
