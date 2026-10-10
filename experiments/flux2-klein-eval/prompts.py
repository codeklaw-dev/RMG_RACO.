"""Deterministic prompt construction for the benchmark (mirrors the planned app compiler)."""

PRESENTATIONS = {
    "ghost_mannequin": (
        "invisible ghost-mannequin product photograph, garment shown in its natural 3D shape with no visible model "
        "or mannequin, front view, centred, full garment in frame, seamless light-grey background, soft even studio lighting"
    ),
    "flat_lay": (
        "flat-lay product photograph from directly above, garment neatly laid flat and fully visible, "
        "seamless light-grey background, soft even studio lighting"
    ),
}

QUALITY = "high-end fashion catalogue photograph, realistic textile texture, crisp construction details, accurate proportions"
EXCLUSIONS = "clean unbranded garment, no logos, no text, no people, no accessories"


def build_prompt(brief, presentation, style="structured"):
    """structured = full fashion template; plain = the designer's sentence only (adherence comparison)."""
    if presentation not in PRESENTATIONS:
        raise ValueError("unknown presentation: %s" % presentation)
    if style == "plain":
        return "%s. %s." % (brief["plain"], PRESENTATIONS[presentation])
    if style != "structured":
        raise ValueError("unknown style: %s" % style)
    details = ", ".join(brief["details"])
    garment = "%s, %s silhouette, in %s, colour %s, with %s" % (brief["garment"], brief["silhouette"], brief["material"], brief["colour"], details)
    return "%s. %s. %s. %s." % (garment, PRESENTATIONS[presentation], QUALITY, EXCLUSIONS)
