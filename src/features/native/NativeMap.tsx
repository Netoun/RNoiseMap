import {
  MouseEvent,
  // WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChunkPosition,
  TILE_SIZE,
  Tile,
  calculateMissingChunks,
  calculateVisibleChunks,
  generateMapGround,
  getColor,
} from "../../utils/generate";
import { styled } from "@stitches/react";
import { Card } from "../../components/atoms/Card";
import { blackA } from "@radix-ui/colors";
import { CHUNK_SIZE } from "../../utils/generate";
import { useDebounce } from "../../hooks/useDebounce";

const Center = styled("div", {
  width: "100%",
  height: "100%",
  position: "absolute",
  top: "0%",
  left: "0%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const Canvas = styled("canvas", {
  zIndex: 20,
  "image-rendering": "crisp-edges",
  marginBlock: "auto",

  borderRadius: "0.5rem",
  boxShadow: "0 2px 10px -3px rgb(0 0 0 / 20%)",
});

const Wrapper = styled("div", {
  height: "100%",
  background: `${blackA.blackA7}`,
});

const Image = styled("img", {
  position: "absolute",
  zIndex: 10,
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  opacity: 0.5,
  filter: "blur(10px)",
});

const Header = styled("header", {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  padding: "1rem",
  zIndex: 20,
});

const Title = styled("h1", {
  fontSize: "large",
});

const WIDTH = 800;
const HEIGHT = 800;

// const MAX_ZOOM = 5;
// const MIN_ZOOM = 1;
// const SCROLL_SENSITIVITY = 0.002;
const SPEED = 0.1;
// const OFFSET = 5;

const NativeMap = () => {
  const canvasTerrainRef = useRef<HTMLCanvasElement>(null);

  const [bg, setBg] = useState("");

  const [chunks, setChunks] = useState<Tile[][][]>([]);

  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  // const [zoom, setZoom] = useState(MIN_ZOOM);
  const [isMoving, setIsMoving] = useState(false);
  const [coordinatesMouse, setCoordinatesMouse] = useState({
    x: 0,
    y: 0,
  });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    const offset = chunkPosition
      ? {
          x: chunkPosition.x * CHUNK_SIZE,
          y: chunkPosition.y * CHUNK_SIZE,
        }
      : undefined;

    return generateMapGround(offset);
  }, []);

  useEffect(() => {
    const visibleChunks = calculateVisibleChunks({
      height: HEIGHT,
      width: WIDTH,
      x: offset.x,
      y: offset.y,
    });

    const missingChunks = calculateMissingChunks(
      visibleChunks,
      chunks.map((chunk) => {
        const value = chunk[0];
        return {
          x: value[0].x,
          y: value[0].y,
        };
      })
    );

    if (missingChunks.length === 0) {
      return;
    }

    const newChunks = [];
    for (const missingChunk of visibleChunks) {
      newChunks.push(generateChunk(missingChunk));
    }
    setChunks([...newChunks]);
  }, [chunks, generateChunk, offset.x, offset.y]);

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const { movementX, movementY, clientX, clientY } = event;
    const rect = canvasTerrainRef?.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    if (event.buttons === 1) {
      setOffset((prevTranslate) => {
        const newX = Math.round(
          prevTranslate.x + Math.round(movementX * SPEED)
        );
        const newY = Math.round(
          prevTranslate.y + Math.round(movementY * SPEED)
        );

        setCoordinatesMouse({
          x: Math.floor((clientX - rect?.left) / TILE_SIZE) - newX,
          y: Math.floor((clientY - rect?.top) / TILE_SIZE) - newY,
        });

        return {
          x: newX,
          y: newY,
        };
      });
    } else {
      if (!isMoving) {
        setCoordinatesMouse({
          x: Math.floor((clientX - rect?.left) / TILE_SIZE) - offset.x,
          y: Math.floor((clientY - rect?.top) / TILE_SIZE) - offset.y,
        });
        return false;
      }
    }
  };

  useEffect(() => {
    const canvasEle = canvasTerrainRef.current;

    if (!canvasEle) {
      return;
    }

    canvasEle.width = WIDTH;
    canvasEle.height = HEIGHT;

    const ctx = canvasEle.getContext("2d", { alpha: false });

    if (ctx) {
      ctx.imageSmoothingEnabled = false;

      setContext(ctx);
    }
  }, []);

  useEffect(() => {
    if (!context) {
      return;
    }
    const startTime = performance.now();

    context.save();
    context.clearRect(0, 0, WIDTH, HEIGHT);

    context.translate(offset.x * TILE_SIZE, offset.y * TILE_SIZE);
    context.scale(1, 1);

    const drawRect = (tile: Tile) => {
      const { posX, posY, w, h, biome, values } = tile;

      context.beginPath();
      context.fillStyle = getColor(biome, values[0]);
      context.fillRect(posX, posY, w, h);
    };

    const drawChunk = (chunk: Tile[][]) => {
      const position = chunk[0][0];

      context.beginPath();
      context.strokeStyle = "red";
      context.strokeRect(
        position.x * TILE_SIZE,
        position.y * TILE_SIZE,
        TILE_SIZE * CHUNK_SIZE,
        TILE_SIZE * CHUNK_SIZE
      );
    };

    if (chunks && chunks?.length > 0) {
      for (const chunk of chunks) {
        drawChunk(chunk);
        for (const tile of chunk.flat()) {
          drawRect(tile);
        }
      }
    }

    context.restore();
    setBg(
      (canvasTerrainRef && canvasTerrainRef.current?.toDataURL("image/png")) ||
        ""
    );
    const endTime = performance.now();
    console.log(`${endTime - startTime}ms`);
  }, [chunks, context, offset]);

  const chunksDebounced = useDebounce(chunks, 200);
  const coordinatesMouseDebounced = useDebounce(coordinatesMouse, 200);

  const currentTile = useMemo(() => {
    const tile = chunksDebounced
      .flat()
      .flat()
      .find((tile) => {
        return (
          tile.x === coordinatesMouseDebounced.x &&
          tile.y === coordinatesMouseDebounced.y
        );
      });

    return tile;
  }, [chunksDebounced, coordinatesMouseDebounced]);

  return (
    <Wrapper>
      <Image src={bg} />
      <Header>
        <Card
          css={{
            justifySelf: "start",
          }}
        >
          <span>x: {coordinatesMouse.x}</span>/
          <span>y: {coordinatesMouse.y}</span>
        </Card>
        <Card
          css={{
            justifySelf: "center",
          }}
        >
          <Title>Procedural map</Title>
        </Card>
        <Card
          css={{
            justifySelf: "end",
          }}
        >
          <span>Biome: {currentTile?.biome}</span>
        </Card>
      </Header>

      <Center>
        <Canvas
          ref={canvasTerrainRef}
          // onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseDown={() => setIsMoving(true)}
          onMouseUp={() => setIsMoving(false)}
          style={{ cursor: "grab" }}
        />
      </Center>
    </Wrapper>
  );
};

export default NativeMap;
