#!/bin/bash
# Font Installation Script
# Downloads required fonts for the PDF Template Automation Engine

cd "$(dirname "$0")/backend/fonts" || exit 1

echo "📥 Installing fonts for PDF Template Automation Engine..."
echo ""

# Nanum Gothic (Korean)
echo "Downloading Nanum Gothic..."
NANUM_DOWNLOADED=0

# Try multiple sources
if [ ! -f "NanumGothic.ttf" ]; then
    # Source 1: GitHub releases (most reliable)
    echo "  Trying GitHub releases..."
    if curl -L -f -o NanumGothic.ttf "https://github.com/naver/nanumfont/releases/download/VER2.5/NanumGothic.zip" 2>/dev/null; then
        if command -v unzip &> /dev/null; then
            unzip -q -o NanumGothic.zip -d . 2>/dev/null
            # Find the actual .ttf file in the zip
            if [ -f "NanumGothic.ttf" ]; then
                rm -f NanumGothic.zip
                NANUM_DOWNLOADED=1
            else
                # Try to find in subdirectories
                find . -name "NanumGothic*.ttf" -exec mv {} NanumGothic.ttf \; 2>/dev/null
                if [ -f "NanumGothic.ttf" ]; then
                    rm -f NanumGothic.zip
                    NANUM_DOWNLOADED=1
                fi
            fi
        fi
    fi
    
    # Source 2: Direct GitHub raw file
    if [ $NANUM_DOWNLOADED -eq 0 ]; then
        echo "  Trying GitHub raw file..."
        if curl -L -f -o NanumGothic.ttf "https://raw.githubusercontent.com/naver/nanumfont/master/packages/nanumgothic/dist/NanumGothic-Regular.ttf" 2>/dev/null; then
            NANUM_DOWNLOADED=1
        fi
    fi
    
    # Source 3: jsDelivr CDN
    if [ $NANUM_DOWNLOADED -eq 0 ]; then
        echo "  Trying jsDelivr CDN..."
        if curl -L -f -o NanumGothic.ttf "https://cdn.jsdelivr.net/gh/naver/nanumfont@master/packages/nanumgothic/dist/NanumGothic-Regular.ttf" 2>/dev/null; then
            NANUM_DOWNLOADED=1
        fi
    fi
    
    # Source 4: Alternative GitHub path
    if [ $NANUM_DOWNLOADED -eq 0 ]; then
        echo "  Trying alternative GitHub path..."
        if curl -L -f -o NanumGothic.ttf "https://github.com/naver/nanumfont/raw/master/packages/nanumgothic/dist/NanumGothic-Regular.ttf" 2>/dev/null; then
            NANUM_DOWNLOADED=1
        fi
    fi
    
    if [ $NANUM_DOWNLOADED -eq 1 ]; then
        echo "✓ Nanum Gothic downloaded successfully"
    else
        echo "⚠ Nanum Gothic download failed from all sources"
        echo ""
        echo "  📥 Manual download required:"
        echo "  1. Visit: https://hangeul.naver.com/2017/nanum"
        echo "  2. Download '나눔고딕' (Nanum Gothic)"
        echo "  3. Extract and copy 'NanumGothic.ttf' to:"
        echo "     $(pwd)/NanumGothic.ttf"
        echo ""
        echo "  Or use Noto Sans KR (already installed) as an alternative."
    fi
else
    echo "✓ Nanum Gothic already exists"
fi

# Noto Sans JP (Japanese)
echo "Downloading Noto Sans JP..."
if [ ! -f "NotoSansJP-VF.ttf" ]; then
    if curl -L -f -o NotoSansJP-VF.ttf "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwdth%2Cwght%5D.ttf" 2>/dev/null; then
        echo "✓ Noto Sans JP downloaded successfully"
    else
        echo "⚠ Failed to download Noto Sans JP"
    fi
else
    echo "✓ Noto Sans JP already exists"
fi

# Noto Sans KR (Korean)
echo "Downloading Noto Sans KR..."
if [ ! -f "NotoSansKR-VF.ttf" ]; then
    if curl -L -f -o NotoSansKR-VF.ttf "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwdth%2Cwght%5D.ttf" 2>/dev/null; then
        echo "✓ Noto Sans KR downloaded successfully"
    else
        echo "⚠ Failed to download Noto Sans KR"
    fi
else
    echo "✓ Noto Sans KR already exists"
fi

echo ""
echo "📋 Installed fonts:"
ls -lh *.ttf *.ttc 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo ""
echo "✅ Font installation complete!"
echo ""
if [ ! -f "NanumGothic.ttf" ]; then
    echo "ℹ️  Note: Nanum Gothic is not installed, but Noto Sans KR is available."
    echo "   Korean text will work fine with Noto Sans KR."
    echo "   To install Nanum Gothic manually, visit: https://hangeul.naver.com/2017/nanum"
    echo ""
fi
echo "Note: For MS Gothic/Mincho and Malgun Gothic, please copy from Windows:"
echo "  - C:\\Windows\\Fonts\\msgothic.ttc"
echo "  - C:\\Windows\\Fonts\\msmincho.ttc"
echo "  - C:\\Windows\\Fonts\\malgun.ttf"
echo ""
echo "See FONTS.md for more information."
