import { Config } from '@remotion/cli/config';

// WebGL в безголовом Chrome на Windows.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
