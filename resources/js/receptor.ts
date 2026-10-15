import { echo } from '@laravel/echo-react';
import './echo';

const targetDiv = document.getElementById('target-div');

if (targetDiv) {
    echo()
        .channel('style-channel')
        .listen(
            '.RemoteStyleUpdate',
            (event: { newText?: string; newStyle?: string }) => {
                targetDiv.innerText = event.newText ?? '';
                targetDiv.style.cssText = event.newStyle ?? '';
            },
        );
}
