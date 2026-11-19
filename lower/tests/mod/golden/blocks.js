scene("0 0 400 400", 400, 400, () => {
  g(() => { transform("translate(100 100)"); face(80) })
  for (let i         = 0; i < 12; i++) line(0, -r * 0.92, 0, -r * 0.8, () => { stroke(INK, r * 0.03) })
  ui.hstack(() => {
    btn("Set 3:00", () => { live.set(false) });
  })
})
const face = (r        ) => g(() => {
  circle(0, 0, r, () => { fill("#fdfdf5") })
})
