*------------------------------------------------------------------------------*
# include "minigui.ch"
# include "fly2pdf.ch"
*------------------------------------------------------------------------------*
Static Function As302()
   *------------------------------------------------------------------------------*
   local xConvenio := 00
   local xPeriodo  := space(07)
   
   DEFINE WINDOW F1 ;
    AT 0,0 ;
    WIDTH 177 HEIGHT 185 ;
    TITLE "Débitos Sócios" ;
    ICON "123.ico" ;
    MODAL ;
    NOSIZE ;
    FONT "Verdana" SIZE 9
   
   @ 05,47 LABEL Label_Convenio ;
    VALUE "CONVÊNIO" ;
    WIDTH 100 ;
    HEIGHT 30 ;
    FONT "Verdana" SIZE 9 ;
    FONTCOLOR BLACK TRANSPARENT BOLD
    
   @ 20,45 GETBOX x_Convenio ;
    VALUE xConvenio ;
    PICTURE "999999";
    WIDTH 80	   	;
    HEIGHT 22 			;
    RIGHTALIGN       ;
    BACKCOLOR {{255,255,255},{255,255,200},{200,255,255}};
    FONTCOLOR BLUE ;
    BOLD  
    
   @ 45,52 LABEL Label_nTitulo ;
    VALUE "MÊS-ANO" ;
    WIDTH 100 ;
    HEIGHT 30 ;
    FONT "Verdana" SIZE 9 ;
    FONTCOLOR BLACK TRANSPARENT BOLD
    
   @ 60,45 GETBOX x_Periodo ;
    VALUE xPeriodo ;
    PICTURE "99-9999";
    WIDTH 80	   	;
    HEIGHT 22 			;
    RIGHTALIGN       ;
    BACKCOLOR {{255,255,255},{255,255,200},{200,255,255}};
    FONTCOLOR BLUE ;
    BOLD  
    
   @ 90,10 BUTTONEX Button_1 WIDTH 70 HEIGHT 25 CAPTION "Acrobat" FONTCOLOR {35,107,142} BOLD ACTION impPensionistas(F1.x_Periodo.Value)
	@ 90,90 BUTTONEX Button_2 WIDTH 70 HEIGHT 25 CAPTION "Excel"   FONTCOLOR {35,107,142} BOLD ACTION ExcelAspmaPensionistas(F1.x_Periodo.Value)
    
   @ 125,10 PROGRESSBAR Progress_1 RANGE 0,100 WIDTH 150 HEIGHT 20
   
   END WINDOW

   CENTER WINDOW F1

   ACTIVATE WINDOW F1

   return
   *------------------------------------------------------------------------------*
Static Function impPensionistas(nPeriodo)
   *------------------------------------------------------------------------------*
   local iQuery, iSocio, iVeja
   local iPagina   := 00
   local iLin      := 00
   local iCol      := 00                                                                    
   local iSize     := 00                                                                    
	local iRow      := {}
   local nx        := 00
   local VlGeral   := 00
   local iValor    := 00
   
   if empty(F1.x_Periodo.Value)
      MsgInfo("PERÍODO INVÁLIDO, VERIFIQUE")
      F1.x_Periodo.SetFocus()
      return(nil)
   endif   
   
   EXECUTE FILE "regsvr32 /s " + GetCurrentFolder() + "\fly2pdf.dll" WAIT
      
   oPDF   := CreateObject("fly2pdf.clsDocument")

   oPage  := CreateObject("fly2pdf.clsPage")

   pageID := oPDF:AddObject(oPage)

   oFont             := CreateObject("fly2pdf.clsFont")
   oFont:FontSubType := eFontSubType_Type1
   oFont:Name        := eFontType1_Courier 

   oPDF:AddObject(oFont)

   oContent := CreateObject("fly2pdf.clsContent")

   iSize := 08
   iLin  := 270
   iCol  := -13
   
   /*
   if !abreServer(n_base)
      return
   endif
   */
   
   if !empty(F1.x_Convenio.Value)
      iQuery := oServer:Query("SELECT parcelas.*,socios.codtipo FROM parcelas LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) WHERE TRIM(parcelas.codconven) = "+alltrim(str(F1.x_Convenio.Value))+" AND month(parcelas.vencimento) = "+left(nPeriodo,02)+" AND year(parcelas.vencimento) = "+right(nPeriodo,04)+" AND TRIM(parcelas.baixa) = '' AND (socios.codtipo = '3' OR socios.codtipo = '4') ORDER BY parcelas.associado,parcelas.matricula,parcelas.sequencia,parcelas.nrseq")
   else
      iQuery := oServer:Query("SELECT parcelas.*,socios.codtipo FROM parcelas LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) WHERE month(parcelas.vencimento) = "+left(nPeriodo,02)+" AND year(parcelas.vencimento) = "+right(nPeriodo,04)+" AND TRIM(parcelas.baixa) = '' AND (socios.codtipo = '3' OR socios.codtipo = '4') ORDER BY parcelas.associado,parcelas.matricula,parcelas.sequencia,parcelas.nrseq")
   endif   
   
   iRow   := iQuery:GetRow(1)
   iSocio := iRow:FieldGet(2)
   iValor := 00
   
   for nx := 1 to iQuery:LastRec()
   
       F1.Progress_1.Value := Int(nx/(iQuery:LastRec()/100) )                                                                                           
       iRow    := iQuery:GetRow(nx)
       VlGeral += iRow:FieldGet(6)
      
      if iSocio == iRow:FieldGet(2)
         iValor += iRow:FieldGet(6)
      else
         iValor := 00
         iValor += iRow:FieldGet(6)
      endif
      
      if iLin = 270
         oContent:Text(replicate(chr(95),119), (oFont), iSize, iCol, 270)
             
         oFont      := CreateObject("fly2pdf.clsFont")
         oFont:Name := eFontType1_Courier_Bold
             
         oContent:Text(padc("DEBITOS DE ASSOCIADOS NO PERIODO DE " + nPeriodo + space(15) + "PAGINA " + strzero(++iPagina,02),119), (oFont), iSize, iCol, 265)
             
         oFont      := CreateObject("fly2pdf.clsFont")
         oFont:Name := eFontType1_Courier
             
         oContent:Text(replicate(chr(95),119), (oFont), iSize, iCol, 264)
            
         oContent:Text(padc("Mat.   Associado                                Conveniado                               Pc De Valor      Total      St",119), (oFont), iSize, iCol, 258)
         oContent:Text(padc(replicate(chr(95),06) + " " + replicate(chr(95),40) + " " + replicate(chr(95),40)+ " " + replicate(chr(95),02)+ " " + replicate(chr(95),02)+ " " + replicate(chr(95),10)+ " " + replicate(chr(95),10)+ " " + replicate(chr(95),02),119), (oFont), iSize, iCol, 257)
            
         oFont      := CreateObject("fly2pdf.clsFont")
         oFont:Name := eFontType1_Courier_Oblique  
            
         iLin := 252
      endif 
      if nx = 1
         oContent:Text(iRow:FieldGet(2)+" "+iRow:FieldGet(8), (oFont), iSize, iCol, iLin)
         --iLin
      endif
      iVeja := iQuery:GetRow(nx+1)
      
      oContent:Text(if(iSocio!=iRow:FieldGet(2),iRow:FieldGet(2)+" "+iRow:FieldGet(8),space(47))+" "+iRow:FieldGet(10)+" "+strzero(val(iRow:FieldGet(4)),02)+" "+;
                    strzero(iRow:FieldGet(11),02)+" "+transform(iRow:FieldGet(6),[@E 999,999.99])+" "+if(iVeja:FieldGet(2)!=iRow:FieldGet(2),transform(iValor,[@E 999,999.99]),space(10)) + " " + if(!empty(iRow:FieldGet(7)),"OK",space(02)), (oFont), iSize, iCol, iLin)
                    
      
		//+" "+if(!empty(iRow:FieldGet(6)),"OK",space(02))              
      
      iLin   := iLin - 4
                 
      if iLin <= -5
         iLin   := 270
         contID := oPDF:AddObject((oContent))
         oPDF:AddObjectToPage(pageID, contID)
         oPage    := CreateObject("fly2pdf.clsPage")
         pageID   := oPDF:AddObject(oPage)
         oContent := CreateObject("fly2pdf.clsContent")
      endif   
      
      iSocio := iRow:FieldGet(2)
   next
   
   iQuery:Destroy()
   
   //fechaServer()
   
   oFont      := CreateObject("fly2pdf.clsFont")
   oFont:Name := eFontType1_Courier
   
   oContent:Text(replicate(chr(95),119), (oFont), iSize, iCol, iLin+3)
   
   oContent:Text(padc("TOTAL: " + alltrim(transform(VlGeral,[@E 999,999,999.99])),119), (oFont), iSize, iCol, iLin-2)
   
   oFont      := CreateObject("fly2pdf.clsFont")
   oFont:Name := eFontType1_Courier_BoldOblique
   
   //oContent:Text(padc("TOTAL GERAL: " + transform(VlGeral,[@E 999,999,999.99]),119), (oFont), iSize, iCol, iLin-2)
   
   contID := oPDF:AddObject((oContent))

   oPDF:AddObjectToPage(pageID, contID)
   
   nArq := "ULTIMO_RELATORIO.PDF"
									  
   oPDF:CreateFile("RELATORIOS\"+nArq)
   EXECUTE FILE (GetCurrentFolder() + "\RELATORIOS\"+nArq)
   
   F1.Progress_1.Value := 00
   F1.x_Convenio.Value := 00
   F1.x_Periodo.Value  := space(07)
   F1.x_Convenio.SetFocus()
   return nil
   *------------------------------------------------------------------------------*
Static Function ExcelAspmaPensionistas(nPeriodo)
   *------------------------------------------------------------------------------*
   local nQuery,iValor,iSocio,iVeja,oExcel,oHoja
   local nLin    := 01
   local iRow    := {}
   local nx      := 00
   local VlGeral := 00
   
   oExcel := TOleAuto():New( "Excel.Application" )
   oExcel:WorkBooks:Add()
   oHoja := oExcel:Get( "ActiveSheet" )
   oHoja:Cells:Font:Name := "Arial"
   oHoja:Cells:Font:Size := 9

   oHoja:Cells( nLin, 1 ):Value := "Matricula"
   oHoja:Cells( nLin, 1 ):HorizontalAlignment:= -4152  //Derecha
   oHoja:Cells( nLin, 2 ):Value := "Associado"
   oHoja:Cells( nLin, 3 ):Value := "Conveniado"
   oHoja:Cells( nLin, 4 ):Value := "Parc"
   oHoja:Cells( nLin, 5 ):Value := "De"
   oHoja:Cells( nLin, 6 ):Value := "Valor"
   oHoja:Cells( nLin, 7 ):Value := "Total"
   oHoja:Cells( nLin, 8 ):Value := "Sit."
   ***Solo en MS office XP
   oHoja:Cells( nLin, 6 ):Set( "NumberFormat", "#.##0,00 €" )
   oHoja:Cells( nLin, 7 ):Set( "NumberFormat", "#.##0,00 €" )

   oHoja:Range(CHR(64+1)+LTRIM(STR(nLin))+":"+CHR(64+8)+LTRIM(STR(nLin))):Font:Bold := .T.
   oHoja:Range(CHR(64+1)+LTRIM(STR(nLin))+":"+CHR(64+8)+LTRIM(STR(nLin))):Interior:ColorIndex := 36 //sombrear celdas
   oHoja:Range(CHR(64+1)+LTRIM(STR(nLin))+":"+CHR(64+8)+LTRIM(STR(nLin))):Borders(4):LineStyle:= 1  //nLinea inferior
   oHoja:Range(CHR(64+1)+LTRIM(STR(nLin))+":"+CHR(64+8)+LTRIM(STR(nLin))):HorizontalAlignment := -4108  //Centrar

   nLin++
   
   /*
   if !abreServer(n_base)
      return
   endif
   */
   
   if !empty(F1.x_Convenio.Value)
      nQuery := oServer:Query("SELECT parcelas.*,socios.codtipo FROM parcelas LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) WHERE TRIM(parcelas.codconven) = "+alltrim(str(F1.x_Convenio.Value))+" AND month(parcelas.vencimento) = "+left(nPeriodo,02)+" AND year(parcelas.vencimento) = "+right(nPeriodo,04)+" AND TRIM(parcelas.baixa) = '' AND (socios.codtipo = '3' OR socios.codtipo = '4') ORDER BY parcelas.associado,parcelas.matricula,parcelas.sequencia,parcelas.nrseq")
   else
      nQuery := oServer:Query("SELECT parcelas.*,socios.codtipo FROM parcelas LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula) WHERE month(parcelas.vencimento) = "+left(nPeriodo,02)+" AND year(parcelas.vencimento) = "+right(nPeriodo,04)+" AND TRIM(parcelas.baixa) = '' AND (socios.codtipo = '3' OR socios.codtipo = '4') ORDER BY parcelas.associado,parcelas.matricula,parcelas.sequencia,parcelas.nrseq")
   endif   
   
   iRow   := nQuery:GetRow(1)
   iSocio := iRow:FieldGet(2)
   iValor := 00
   
   for nx := 1 to nQuery:LastRec()
      F1.Progress_1.Value := Int(nx/(nQuery:LastRec()/100) )
      iRow := nQuery:GetRow(nx)
      VlGeral += iRow:FieldGet(6)
      if iSocio = iRow:FieldGet(2)
         iValor += iRow:FieldGet(6)
      else
         iValor := 00
         iValor += iRow:FieldGet(6)
      endif
      iVeja := nQuery:GetRow(nx+1)
      oHoja:Cells( nLin, 1 ):Value := iRow:FieldGet(2)
      oHoja:Cells( nLin, 2 ):Value := left(iRow:FieldGet(8),35)
      oHoja:Cells( nLin, 3 ):Value := left(iRow:FieldGet(10),25)
      oHoja:Cells( nLin, 4 ):Value := strzero(val(iRow:FieldGet(4)),02)
      oHoja:Cells( nLin, 5 ):Value := strzero(iRow:FieldGet(11),02)
      oHoja:Cells( nLin, 6 ):Value := iRow:FieldGet(6)
      oHoja:Cells( nLin, 7 ):Value := if(iVeja:FieldGet(2)!=iRow:FieldGet(2),iValor,space(10))
      oHoja:Cells( nLin, 8 ):Value := if(!empty(iRow:FieldGet(7)),"*OK*",space(04))
      oHoja:Cells( nLin, 6 ):Set( "NumberFormat", "###.###,00" )
      oHoja:Cells( nLin, 7 ):Set( "NumberFormat", "###.###,00" )
      nLin++
      iSocio := iRow:FieldGet(2)
   next
   
   F1.Progress_1.Value := 00
   F1.x_Convenio.Value := 00
   F1.x_Periodo.Value  := space(07)
   
   //oHoja:Cells( nLin, 7 ):Value := VlGeral
   //oHoja:Cells( nLin, 7 ):Set( "NumberFormat", "###.###.###,00" )
   
   nQuery:Destroy()
   
   for nCol:=1 TO 8
      oHoja:Columns( nCol ):AutoFit()
   next
   oHoja:Cells( 2, 1 ):Select()
   oExcel:Visible := .T.
   
   //fechaServer()

   Return
   *------------------------------------------------------------------------------*
