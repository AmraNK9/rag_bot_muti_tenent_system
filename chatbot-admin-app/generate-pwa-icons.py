#!/usr/bin/env python3
"""
Generate PWA icons from logo.png in multiple sizes.
Requires Pillow: pip install Pillow
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Installing Pillow...")
    os.system(f"{sys.executable} -m pip install Pillow --quiet")
    from PIL import Image

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_LOGO = os.path.join(SCRIPT_DIR, "public", "logo.png")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "public", "pwa-icons")
MASKABLE_SOURCE = r"C:\Users\USER\.gemini\antigravity\brain\f56a6dad-c687-441d-939d-cf2b9a2c459f\pwa_maskable_icon_1784093233104.png"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Icon sizes to generate
SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]

def generate_transparent_icon(source_path, output_path, size):
    """Resize icon maintaining transparency."""
    img = Image.open(source_path).convert("RGBA")
    # Create a new transparent canvas
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Scale the logo to fit within 85% of the canvas
    logo_size = int(size * 0.85)
    img_resized = img.resize((logo_size, logo_size), Image.LANCZOS)
    # Center it
    offset = (size - logo_size) // 2
    canvas.paste(img_resized, (offset, offset), img_resized)
    # Save as PNG
    canvas.save(output_path, "PNG", optimize=True)
    print(f"  ✅ Generated: {os.path.basename(output_path)} ({size}x{size})")

def generate_maskable_icon(source_path, output_path, size):
    """Generate maskable icon with solid background."""
    try:
        img = Image.open(source_path).convert("RGBA")
    except Exception:
        # Fall back to logo if maskable source not found
        img = Image.open(SOURCE_LOGO).convert("RGBA")
    
    # Create teal background
    canvas = Image.new("RGBA", (size, size), (13, 148, 136, 255))
    # Scale logo to 60% of canvas (safe zone for maskable)
    logo_size = int(size * 0.60)
    img_resized = img.resize((logo_size, logo_size), Image.LANCZOS)
    # Center it
    offset = (size - logo_size) // 2
    canvas.paste(img_resized, (offset, offset), img_resized)
    canvas.save(output_path, "PNG", optimize=True)
    print(f"  ✅ Generated maskable: {os.path.basename(output_path)} ({size}x{size})")

print("\n🎨 PhyayPay PWA Icon Generator")
print("=" * 40)
print(f"Source: {SOURCE_LOGO}")
print(f"Output: {OUTPUT_DIR}\n")

# Generate all regular icons
for size in SIZES:
    filename = f"icon-{size}.png" if size != 180 else "apple-touch-icon.png"
    output_path = os.path.join(OUTPUT_DIR, filename)
    generate_transparent_icon(SOURCE_LOGO, output_path, size)
    # Also save apple-touch-icon for 180
    if size == 180:
        generate_transparent_icon(SOURCE_LOGO, os.path.join(OUTPUT_DIR, "icon-180.png"), size)

# Generate maskable icon
generate_maskable_icon(MASKABLE_SOURCE, os.path.join(OUTPUT_DIR, "icon-maskable-512.png"), 512)

# Generate placeholder screenshots (simple colored images)
print("\n📸 Generating placeholder screenshots...")

def create_screenshot(output_path, width, height, label):
    """Create a simple placeholder screenshot."""
    img = Image.new("RGB", (width, height), (15, 23, 42))  # dark background
    img.save(output_path, "PNG")
    print(f"  ✅ Generated: {os.path.basename(output_path)} ({width}x{height})")

create_screenshot(os.path.join(OUTPUT_DIR, "screenshot-wide.png"), 1280, 720, "wide")
create_screenshot(os.path.join(OUTPUT_DIR, "screenshot-narrow.png"), 390, 844, "narrow")

print("\n✨ All PWA icons generated successfully!")
print(f"📁 Output directory: {OUTPUT_DIR}")
print(f"📦 Total files: {len(os.listdir(OUTPUT_DIR))}")
