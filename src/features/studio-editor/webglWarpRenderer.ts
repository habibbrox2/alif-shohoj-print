/**
 * WebGL renderer that draws an image through a projective (perspective) warp
 * defined by four destination corners. The inverse homography is computed on the
 * CPU (see quadWarp.ts) and uploaded as a uniform; the fragment shader maps each
 * destination pixel back to source UV, giving correct perspective interpolation.
 */

import { computeHomography, applyHomography, type Quad, type Homography } from './quadWarp.js';

export interface WebGLWarpRenderer {
  setImage(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): void;
  /** Destination corners in normalized 0..1 coordinates (top-left, top-right, bottom-right, bottom-left). */
  setCorners(corners: Quad): void;
  render(): void;
  dispose(): void;
  readonly canvas: HTMLCanvasElement;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_image;
uniform mat3 u_invH;
uniform vec2 u_resolution;
void main() {
  vec2 p = gl_FragCoord.xy / u_resolution;
  p.y = 1.0 - p.y;
  vec3 src = u_invH * vec3(p, 1.0);
  if (abs(src.z) < 1e-6) { gl_FragColor = vec4(0.0); return; }
  vec2 uv = src.xy / src.z;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = texture2D(u_image, uv);
}
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const toMat3Array = (H: Homography): Float32Array => new Float32Array(H);

export const createWebGLWarpRenderer = (canvas: HTMLCanvasElement): WebGLWarpRenderer | null => {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const imageLocation = gl.getUniformLocation(program, 'u_image');
  const invHLocation = gl.getUniformLocation(program, 'u_invH');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let currentImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap | null = null;
  // Default corners = identity (full quad).
  let corners: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  // Source quad corners in normalized coordinates.
  const sourceQuad: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const setImage = (image: HTMLImageElement | HTMLCanvasElement | ImageBitmap) => {
    currentImage = image;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };

  const setCorners = (newCorners: Quad) => {
    corners = newCorners;
  };

  const render = () => {
    if (!currentImage) return;
    // Compute inverse homography: dst -> src.
    const H = computeHomography(corners, sourceQuad);
    if (!H) return;
    // Inverse of H.
    const a = H;
    const det =
      a[0] * (a[4] * a[8] - a[5] * a[7]) -
      a[1] * (a[3] * a[8] - a[5] * a[6]) +
      a[2] * (a[3] * a[7] - a[4] * a[6]);
    if (Math.abs(det) < 1e-12) return;
    const inv: Homography = [
      (a[4] * a[8] - a[5] * a[7]) / det,
      (a[2] * a[7] - a[1] * a[8]) / det,
      (a[1] * a[5] - a[2] * a[4]) / det,
      (a[5] * a[6] - a[3] * a[8]) / det,
      (a[0] * a[8] - a[2] * a[6]) / det,
      (a[2] * a[3] - a[0] * a[5]) / det,
      (a[3] * a[7] - a[4] * a[6]) / det,
      (a[1] * a[6] - a[0] * a[7]) / det,
      (a[0] * a[4] - a[1] * a[3]) / det,
    ];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (imageLocation) gl.uniform1i(imageLocation, 0);
    if (invHLocation) gl.uniformMatrix3fv(invHLocation, false, toMat3Array(inv));
    if (resolutionLocation) gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const dispose = () => {
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  };

  return { canvas, setImage, setCorners, render, dispose };
};