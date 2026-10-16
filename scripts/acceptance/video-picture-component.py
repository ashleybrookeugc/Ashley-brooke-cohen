"""Non-private local visual component acceptance. Run with the installed vision venv.
Usage: python scripts/acceptance/video-picture-component.py MODEL_DIRECTORY OUTPUT_DIRECTORY
No media or inference is transferred; output images and receipts stay in OUTPUT_DIRECTORY.
"""
import os
os.environ.update(HF_HUB_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TRANSFORMERS_OFFLINE='1')
import sys,json,time,importlib.util
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[2]).resolve();root.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
for state in ['before','after']:
    image=Image.new('RGB',(720,480),'#e7e5df');d=ImageDraw.Draw(image)
    d.rectangle((0,330,720,480),fill='#a77849')
    d.rectangle((20,30,180,180),fill='#c7e4f1',outline='#243a4d',width=8)
    d.line((100,30,100,180),fill='#243a4d',width=5)
    d.line((20,105,180,105),fill='#243a4d',width=5)
    d.rectangle((310,100,650,310),fill='#263440')
    d.rectangle((325,115,635,290),fill='#f9f9f9')
    d.rectangle((467,310,490,350),fill='#263440');d.rectangle((410,350,550,365),fill='#263440')
    d.text((350,145),'VIDEO EDITOR',font=font,fill='#17252d')
    d.rectangle((350,220,610,260),fill='#2e6685')
    if state=='before':
        d.ellipse((190,265,290,325),fill='#b21e2b')
        d.rectangle((190,292,290,365),fill='#b21e2b')
        d.ellipse((260,285,320,350),outline='#b21e2b',width=12)
    else:
        d.rounded_rectangle((200,230,275,365),radius=18,fill='#2378bd')
        d.rectangle((220,210,255,240),fill='#2378bd');d.rectangle((220,200,255,215),fill='#153d61')
        d.rectangle((370,170,610,265),fill='#e9eee4',outline='#33572c',width=4)
        d.text((393,185),'EXPORT READY',font=font,fill='#33572c')
    image.save(root/(state+'.jpg'))

spec=importlib.util.spec_from_file_location('vision_infer',Path(__file__).resolve().parents[2]/'tools/video-testing/vision-infer.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
vision=module.Vision(sys.argv[1]);images=[str(root/'before.jpg'),str(root/'after.jpg')];start=time.monotonic()
positives=[vision.describe(images[:1]),vision.describe(images)]
negatives=[
 {'description':'A person in a red coat drives a yellow car through a forest.','change':''},
 {'description':'The person is frustrated and wants to leave.','change':''},
 {'description':'The video export has completed successfully.','change':''},
 {'description':'There is a blue bottle next to a computer monitor.','change':'The blue bottle has been replaced by a red mug.'},
 {'description':'A speaker says EXPORT READY aloud.','change':''},
 {'description':'The user clicked Export and waited for the file to finish rendering.','change':''},
 {'description':'This is a photo of Ashley in New York.','change':''},
]
checks=[dict(claim=c,check=vision.check(images,c)) for c in negatives]
accepted=lambda check:check.get('description_supported') is True and check.get('change_supported') is True and check.get('unsupported_details')==[]
receipt=dict(positives=positives,negative_controls=checks,positive_accepted=sum(accepted(p['check']) for p in positives),unsupported_released=sum(accepted(c['check']) for c in checks),seconds=round(time.monotonic()-start,3))
(root/'component-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt,indent=2))
if receipt['unsupported_released'] or receipt['positive_accepted']!=2:sys.exit(1)
