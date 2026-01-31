// glass-lens.js
(function () {
    const REFRACTION = 0.01
    const RAMP = 9.5
    function createShader(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(s));
        }
        return s;
    }

    const fragSrc = `
        precision mediump float;

        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform vec2 u_imageSize;
        uniform vec2 u_mouse;
        uniform vec2 u_origin;     // ⭐ NEW: sampling origin in natural image pixels
        uniform float u_radius;
        uniform float u_zoom;      // ⭐ NEW: your effZoom
        uniform float u_refraction;
        uniform float u_aberration;
        uniform vec2 u_centerNat; // naturalX, naturalY
        uniform float u_ramp;

        void main() {
            vec2 frag = gl_FragCoord.xy;
            vec2 center = u_mouse;

            float distPx = distance(frag, center);
            float d = distPx / u_radius;

            // Hard circular cutoff
            if (d > 1.0) {
                discard;
            }

            // Lens-local offset
            vec2 lensOffset = frag - center;

            // Map to natural image pixel
            vec2 imgPx = u_centerNat + lensOffset / u_zoom;

            // Convert to UV
            vec2 baseUv = vec2(
                imgPx.x / u_imageSize.x,
                imgPx.y / u_imageSize.y
            );

            // Distortion curve
            float ring = pow(d, u_ramp);
            float bend = u_refraction * ring;

            // Outward distortion
            vec2 dir = -normalize(lensOffset);

            // Convert aberration from "constant UV shift" to "lens-relative pixel shift"
            float aberr = u_aberration * d / u_zoom;   // scale by distance from center

            vec2 uvR = clamp(baseUv + dir * (bend + aberr), 0.0, 1.0);
            vec2 uvG = clamp(baseUv + dir * bend,           0.0, 1.0);
            vec2 uvB = clamp(baseUv + dir * (bend - aberr), 0.0, 1.0);

            // Sample image
            float r = texture2D(u_image, uvR).r;
            float g = texture2D(u_image, uvG).g;
            float b = texture2D(u_image, uvB).b;

            vec3 color = vec3(r, g, b);

            // Rim-only fresnel (no center boost)
            float fresnel = pow(d, 8.0);   // 0 at center, 1 at edge
            color *= 1.0 + fresnel * 0.5; // subtle rim brightening


            // Output final color (fully opaque)
            gl_FragColor = vec4(color, 1.0);
        }

    `;

    const vertSrc = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    `;

    function init(opts) {
        const container = document.getElementById(opts.containerId);
        if (!container) {
            console.error('GlassLens: container not found:', opts.containerId);
            return;
        }

        const radius = opts.radius || 160;
        const refraction = opts.refraction || 0.16;
        const aberration = opts.aberration || 0.004;

        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        container.style.position = container.style.position || 'absolute';
        container.appendChild(canvas);

        const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
        if (!gl) {
            console.error('GlassLens: WebGL not supported');
            return;
        }

        

        function resize() {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        resize();
        window.addEventListener('resize', resize);

        const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.useProgram(program);

        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ]),
            gl.STATIC_DRAW
        );

        const aPos = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const u_image = gl.getUniformLocation(program, 'u_image');
        const u_resolution = gl.getUniformLocation(program, 'u_resolution');
        const u_imageSize = gl.getUniformLocation(program, 'u_imageSize');
        const u_mouse = gl.getUniformLocation(program, 'u_mouse');
        const u_centerNat = gl.getUniformLocation(program, 'u_centerNat'); // ⭐ NEW
        const u_zoom = gl.getUniformLocation(program, 'u_zoom');

        const u_radius = gl.getUniformLocation(program, 'u_radius');
        const u_refraction = gl.getUniformLocation(program, 'u_refraction');
        const u_aberration = gl.getUniformLocation(program, 'u_aberration');
        const u_ramp = gl.getUniformLocation(program, "u_ramp");


        let mouse = { x: 0, y: 0 };
        let centerNat = { x: 0, y: 0 };
        let zoom = 1.0;


        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = opts.imageSrc;

        img.onload = () => {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            function render() {
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                gl.uniform1i(u_image, 0);
                gl.uniform2f(u_resolution, canvas.width, canvas.height);
                gl.uniform2f(u_imageSize, img.width, img.height);
                gl.uniform2f(u_mouse, mouse.x, mouse.y);
                gl.uniform2f(u_centerNat, centerNat.x, centerNat.y);
                gl.uniform1f(u_zoom, zoom);
                gl.uniform1f(u_radius, radius);
                gl.uniform1f(u_refraction, REFRACTION);
                gl.uniform1f(u_aberration, aberration);
                gl.uniform1f(u_ramp, RAMP);

                gl.drawArrays(gl.TRIANGLES, 0, 6);
                requestAnimationFrame(render);
            }

            render();
        };

        return {
            setPointer(x, y) {
                const rect = container.getBoundingClientRect();
                mouse.x = x - rect.left;
                mouse.y = rect.height - (y - rect.top);
            },
            setCenter(nx, ny) {
                centerNat.x = nx;
                centerNat.y = ny;
            },
            setZoom(z) {
                zoom = z;
            }
        };

    }

    window.GlassLens = { init };
})();
