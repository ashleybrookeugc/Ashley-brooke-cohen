import page from '../../public/video-test/index.html';
import {handleVideoTesting,securityHeaders} from './gateway.js';
export async function videoTestingRoute(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/video-test'||path==='/video-test/'||path==='/video-test/index.html')return new Response(page,{headers:{...securityHeaders,'content-type':'text/html;charset=utf-8'}});
  if(path.startsWith('/api/video-test/'))return handleVideoTesting(request,env);
  return null;
}
