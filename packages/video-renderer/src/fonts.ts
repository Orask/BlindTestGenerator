import { loadFont as loadBaloo2 } from "@remotion/google-fonts/Baloo2";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

// Loaded once here with only the weights actually used, instead of each
// component calling loadFont() itself with defaults — the default pulls
// every weight/subset (dozens of network requests), and Remotion renders
// with several parallel browser tabs that each pay that cost, which was
// slow enough in practice to trip the "initial render" timeout.
export const { fontFamily: baloo2FontFamily } = loadBaloo2("normal", {
  weights: ["700"],
  subsets: ["latin"],
});

export const { fontFamily: poppinsFontFamily } = loadPoppins("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
});
