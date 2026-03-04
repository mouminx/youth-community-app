export type AvatarOptions = {
  hair?: string;
  head?: string;
  eyes?: string;
  mouth?: string;
  eyebrows?: string;
  nose?: string;
  skinColor?: string;
  glasses?: string;
  translateX?: number;
  translateY?: number;
  flip?: boolean;
};

export function dicebearUrl(
  seed: string,
  bg: string,
  size = 160,
  opts: AvatarOptions = {}
) {
  const s = encodeURIComponent(seed || "default");
  let url = `https://api.dicebear.com/9.x/lorelei/svg?seed=${s}&backgroundColor=${bg}&size=${size}`;

  if (opts.hair)     url += `&hair[]=${opts.hair}`;
  if (opts.head)     url += `&head[]=${opts.head}`;
  if (opts.eyes)     url += `&eyes[]=${opts.eyes}`;
  if (opts.mouth)    url += `&mouth[]=${opts.mouth}`;
  if (opts.eyebrows) url += `&eyebrows[]=${opts.eyebrows}`;
  if (opts.nose)     url += `&nose[]=${opts.nose}`;
  if (opts.skinColor) url += `&skinColor[]=${opts.skinColor}`;

  if (opts.glasses === "none") {
    url += `&glassesProbability=0`;
  } else if (opts.glasses) {
    url += `&glasses[]=${opts.glasses}&glassesProbability=100`;
  }

  if (opts.translateX) url += `&translateX=${opts.translateX}`;
  if (opts.translateY) url += `&translateY=${opts.translateY}`;
  if (opts.flip)       url += `&flip=true`;

  return url;
}
