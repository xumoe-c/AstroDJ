import JSZip from 'jszip'

export class ZipPackager {
  async package(
    chartJSON: string,
    audioFile: File,
    chartName: string,
    coverArt?: string | null,
    backgroundImage?: string | null
  ): Promise<Blob> {
    const zip = new JSZip()

    // Add chart.json
    zip.file('chart.json', chartJSON)

    // Add audio file
    zip.file(audioFile.name, audioFile)

    // Add cover art if available
    if (coverArt) {
      const coverBlob = await this.dataUrlToBlob(coverArt)
      const coverExt = this.getImageExtension(coverArt)
      zip.file(`cover.${coverExt}`, coverBlob)
    }

    // Add background image if available and different from cover
    if (backgroundImage && backgroundImage !== coverArt) {
      const bgBlob = await this.dataUrlToBlob(backgroundImage)
      const bgExt = this.getImageExtension(backgroundImage)
      zip.file(`bg.${bgExt}`, bgBlob)
    }

    // Generate ZIP blob
    return await zip.generateAsync({ type: 'blob' })
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl)
    return await response.blob()
  }

  private getImageExtension(dataUrl: string): string {
    // Extract MIME type from data URL
    const match = dataUrl.match(/^data:image\/(\w+);base64,/)
    if (match && match[1]) {
      return match[1] === 'jpeg' ? 'jpg' : match[1]
    }
    return 'jpg' // Default to jpg
  }
}
