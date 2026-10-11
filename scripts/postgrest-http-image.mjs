// No release or image is selected while local binary provenance is unverified.
// Populate only after operator-approved image preparation and compatibility review.
// Required fields are documented in postgrest-http-contract.mjs. Never auto-pull/build.
export const httpImagePins = {
  imageDigest: "sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa",
  imageId: "sha256:fac586b778caa90c16b0cd2b3a807cfcb855d994da40c0e37af4555b8f4293aa",
  postgrestImage: "public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962",
  nodeImage: "docker.io/library/node@sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174",
  postgrestVersion: "16.3",
  postgrestSha256: "0cf367dc2ee47d5c648baa2952e25bdf299de4e1998d31e251bb00d129262d71",
  sourceSha256: "64bc4bd73e2de9f6d37d2157564e1ba7f8cf6d645f6598f7cb3654213083c493",
};
