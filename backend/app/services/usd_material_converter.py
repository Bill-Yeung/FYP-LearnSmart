import os
import io
import zipfile

def _find_texture_for_material(mat_name: str, texture_dir: str, tex_type: str) -> str | None:

    if not os.path.isdir(texture_dir):
        return None

    DIFF_KEYWORDS  = ("diff", "color", "col_", "albedo", "base_color")
    ROUGH_KEYWORDS = ("rough",)
    METAL_KEYWORDS = ("metal",)

    keywords = {"diff": DIFF_KEYWORDS, "rough": ROUGH_KEYWORDS, "metal": METAL_KEYWORDS}.get(tex_type, (tex_type,))
    img_exts = (".jpg", ".jpeg", ".png")

    files = os.listdir(texture_dir)
    mat_lower = mat_name.lower()
    mat_parts = sorted(mat_lower.split("_"), key=len, reverse=True)

    for f in files:
        fl = f.lower()
        if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
            if mat_lower in fl:
                return os.path.join(texture_dir, f)
            
    for part in mat_parts:
        if len(part) < 3:
            continue
        for f in files:
            fl = f.lower()
            if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
                if part in fl:
                    return os.path.join(texture_dir, f)

    for f in files:
        fl = f.lower()
        if any(kw in fl for kw in keywords) and fl.endswith(img_exts):
            return os.path.join(texture_dir, f)

    return None


def _convert_usdc_materials(usdc_path: str, texture_dir: str) -> str:

    try:
        from pxr import Usd, UsdShade, Sdf, Gf
    except ImportError:
        return usdc_path

    stage = Usd.Stage.Open(usdc_path)
    if not stage:
        return usdc_path

    for prim in stage.Traverse():
        if not prim.IsA(UsdShade.Material):
            continue

        material = UsdShade.Material(prim)
        mat_path = prim.GetPath()
        mat_name = prim.GetName()

        diffuse_tex  = _find_texture_for_material(mat_name, texture_dir, "diff")
        roughness_tex = _find_texture_for_material(mat_name, texture_dir, "rough")

        for child in list(prim.GetChildren()):
            stage.RemovePrim(child.GetPath())

        shader_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("PBRShader"))
        shader_prim.CreateIdAttr("UsdPreviewSurface")

        def _asset_path(abs_tex: str) -> str:
            return "textures/" + os.path.basename(abs_tex)

        if diffuse_tex:
            tex_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("DiffuseTexture"))
            tex_prim.CreateIdAttr("UsdUVTexture")
            tex_prim.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath(_asset_path(diffuse_tex)))
            tex_prim.CreateInput("wrapS", Sdf.ValueTypeNames.Token).Set("repeat")
            tex_prim.CreateInput("wrapT", Sdf.ValueTypeNames.Token).Set("repeat")
            rgb_out = tex_prim.CreateOutput("rgb", Sdf.ValueTypeNames.Float3)
            shader_prim.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).ConnectToSource(rgb_out)
        else:
            shader_prim.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(0.8, 0.8, 0.8))

        if roughness_tex:
            rtex_prim = UsdShade.Shader.Define(stage, mat_path.AppendChild("RoughnessTexture"))
            rtex_prim.CreateIdAttr("UsdUVTexture")
            rtex_prim.CreateInput("file", Sdf.ValueTypeNames.Asset).Set(Sdf.AssetPath(_asset_path(roughness_tex)))
            r_out = rtex_prim.CreateOutput("r", Sdf.ValueTypeNames.Float)
            shader_prim.CreateInput("roughness", Sdf.ValueTypeNames.Float).ConnectToSource(r_out)
        else:
            shader_prim.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.6)

        shader_prim.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)

        surface_out = shader_prim.CreateOutput("surface", Sdf.ValueTypeNames.Token)
        material.CreateSurfaceOutput().ConnectToSource(surface_out)

    out_path = usdc_path.replace(".usdc", "_converted.usdc")
    stage.Export(out_path)

    usda_path = out_path.replace(".usdc", ".usda")
    stage2 = Usd.Stage.Open(out_path)
    stage2.Export(usda_path)
    with open(usda_path, "r") as f:
        content = f.read()
    import re
    content = re.sub(r'@[^@]*/textures/([^@]+)@', r'@./textures/\1@', content)
    with open(usda_path, "w") as f:
        f.write(content)
    stage3 = Usd.Stage.Open(usda_path)
    stage3.Export(out_path)
    os.remove(usda_path)

    return out_path

def build_usdz(entries: list[tuple[str, bytes]]) -> bytes:

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in entries:
            zf.writestr(name, data)
    return buf.getvalue()


