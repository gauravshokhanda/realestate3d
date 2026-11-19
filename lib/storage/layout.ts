export function frameFolder(developmentSlug: string, propertySlug: string, scene: string) {
  return `cache/frames/${developmentSlug}/${propertySlug}/${scene}`;
}

export function originalFolder(developmentSlug: string, propertyId: string) {
  return `originals/${developmentSlug}/${propertyId}`;
}
