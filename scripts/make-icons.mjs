// Рисует PNG-иконки rent.kz (белый домик на карамельном градиенте) без внешних библиотек.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const TOP = [194, 134, 79]
const BOTTOM = [148, 88, 42]
const FG = [255, 255, 255]
const DOOR = [74, 52, 36]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function pixel(x, y) {
  const h = isHouse(x, y)
  if (h === 'door') return DOOR
  if (h) return FG
  return TOP.map((c, i) => Math.round(c + (BOTTOM[i] - c) * y))
}

function isHouse(x, y) {
  // координаты 0..1
  const roofTop = 0.22, roofBase = 0.48, wallBottom = 0.78
  if (y >= roofTop && y <= roofBase) {
    const half = ((y - roofTop) / (roofBase - roofTop)) * 0.34
    if (Math.abs(x - 0.5) <= half) return true
  }
  if (y > roofBase && y <= wallBottom && x >= 0.27 && x <= 0.73) {
    // дверь
    if (x >= 0.44 && x <= 0.56 && y >= 0.6) return 'door'
    return true
  }
  return false
}

function png(size) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const c = pixel((x + 0.5) / size, (y + 0.5) / size)
      row.set(c, 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size))
}
console.log('icons ok')
