"""Prepara il progetto Android generato da Capacitor per la build.

- aggiunge l'App ID di AdMob al manifest
- imposta versionCode dal numero di build di Codemagic
- se c'è un keystore (build di release), configura la firma
"""
import os
import re

MANIFEST = "android/app/src/main/AndroidManifest.xml"
GRADLE = "android/app/build.gradle"
ADMOB_APP_ID = "ca-app-pub-5787516371588469~8054706643"

manifest = open(MANIFEST).read()
if "com.google.android.gms.ads.APPLICATION_ID" not in manifest:
    manifest = manifest.replace(
        "</application>",
        '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" '
        f'android:value="{ADMOB_APP_ID}"/>\n    </application>',
        1,
    )
    open(MANIFEST, "w").write(manifest)
    print("AdMob App ID aggiunto al manifest")

gradle = open(GRADLE).read()
build_number = os.environ.get("BUILD_NUMBER")
if build_number and build_number.isdigit():
    gradle = re.sub(r"versionCode\s+\d+", f"versionCode {int(build_number)}", gradle)
    print(f"versionCode = {build_number}")

if os.environ.get("CM_KEYSTORE_PATH") and "signingConfigs.btRelease" not in gradle:
    gradle += """
android {
    signingConfigs {
        btRelease {
            storeFile file(System.getenv("CM_KEYSTORE_PATH"))
            storePassword System.getenv("CM_KEYSTORE_PASSWORD")
            keyAlias System.getenv("CM_KEY_ALIAS")
            keyPassword System.getenv("CM_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.btRelease
        }
    }
}
"""
    print("Firma di release configurata")

open(GRADLE, "w").write(gradle)
