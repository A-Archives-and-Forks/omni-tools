import { Box } from '@mui/material';
import React, { useState } from 'react';
import ToolFileResult from '@components/result/ToolFileResult';
import TextFieldWithDesc from 'components/options/TextFieldWithDesc';
import ToolContent from '@components/ToolContent';
import { ToolComponentProps } from '@tools/defineTool';
import ToolImageInput from '@components/input/ToolImageInput';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const initialValues = {
  newSpeed: 2
};
export default function ChangeSpeed({ title }: ToolComponentProps) {
  const [input, setInput] = useState<File | null>(null);
  const [result, setResult] = useState<File | null>(null);

  const compute = (optionsValues: typeof initialValues, input: File | null) => {
    if (!input) return;
    const { newSpeed } = optionsValues;
    // Initialize FFmpeg once in your component/app
    let ffmpeg: FFmpeg | null = null;
    let ffmpegLoaded = false;

    const processImage = async (
      file: File,
      newSpeed: number
    ): Promise<void> => {
      if (!ffmpeg) {
        ffmpeg = new FFmpeg();
      }

      if (!ffmpegLoaded) {
        await ffmpeg.load({
          wasmURL:
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm/ffmpeg-core.wasm'
        });
        ffmpegLoaded = true;
      }

      try {
        await ffmpeg.writeFile('input.gif', await fetchFile(file));

        // Process the GIF to change playback speed while preserving quality
        // The filter_complex does three main operations:
        // 1. [0:v]setpts=${1/newSpeed}*PTS - Adjusts frame timing:
        //    - PTS (Presentation Time Stamp) controls when each frame is displayed
        //    - Dividing by speed factor (e.g., 2 for 2x speed) reduces display time
        //    - Example: 1/2 = 0.5 → frames show for half their normal duration
        // 2. split[a][b] - Creates two identical streams for parallel processing:
        //    - [a] goes to palettegen to create an optimized color palette
        //    - [b] contains the speed-adjusted frames
        // 3. [b][p]paletteuse - Applies the generated palette to maintain:
        //    - Color accuracy
        //    - Transparency handling
        //    - Reduced file size
        // This approach prevents visual artifacts that occur with simple re-encoding
        await ffmpeg.exec([
          '-i',
          'input.gif',
          '-filter_complex',
          `[0:v]setpts=${
            1 / newSpeed
          }*PTS,split[a][b];[a]palettegen[p];[b][p]paletteuse`,
          '-f',
          'gif',
          'output.gif'
        ]);

        // Read the result
        const data = await ffmpeg.readFile('output.gif');

        // Create a new file from the processed data
        const blob = new Blob([data], { type: 'image/gif' });
        const newFile = new File(
          [blob],
          file.name.replace('.gif', `-${newSpeed}x.gif`),
          {
            type: 'image/gif'
          }
        );

        // Clean up to free memory
        await ffmpeg.deleteFile('input.gif');
        await ffmpeg.deleteFile('output.gif');

        setResult(newFile);
      } catch (error) {
        console.error('Error processing GIF:', error);
        throw error;
      }
    };

    processImage(input, newSpeed);
  };
  return (
    <ToolContent
      title={title}
      input={input}
      inputComponent={
        <ToolImageInput
          value={input}
          onChange={setInput}
          accept={['image/gif']}
          title={'Input GIF'}
        />
      }
      resultComponent={
        <ToolFileResult
          title={'Output GIF with new speed'}
          value={result}
          extension={'gif'}
        />
      }
      initialValues={initialValues}
      getGroups={({ values, updateField }) => [
        {
          title: 'New GIF speed',
          component: (
            <Box>
              <TextFieldWithDesc
                value={values.newSpeed}
                onOwnChange={(val) => updateField('newSpeed', Number(val))}
                description={'Default multiplier: 2 means 2x faster'}
                type={'number'}
              />
            </Box>
          )
        }
      ]}
      compute={compute}
      setInput={setInput}
    />
  );
}
