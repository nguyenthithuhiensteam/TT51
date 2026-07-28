"""Sinh bộ icon MN360 tối giản (chữ M trên nền navy) cho đóng gói Tauri.
Chạy một lần trong quá trình phát triển; không cần chạy lại trừ khi đổi logo.
"""
from PIL import Image, ImageDraw, ImageFont

NAVY = (10, 31, 78, 255)
BLUE = (26, 107, 219, 255)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=NAVY)
    text = "M360"
    font_size = int(size * 0.34)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, font=font, fill=BLUE)
    return img


sizes = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}

images = {}
for name, size in sizes.items():
    im = make_icon(size)
    im.save(name)
    images[size] = im
    print("wrote", name)

base = images[512]
base.save("icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("wrote icon.ico")

try:
    base.save("icon.icns")
    print("wrote icon.icns")
except Exception as exc:  # pragma: no cover
    print("icns skipped:", exc)
